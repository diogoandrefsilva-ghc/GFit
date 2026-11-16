import { useState } from 'react'
import { NumberInput } from '@/components/NumberInput'
import { Loading } from '@/components/Screen'
import {
  deleteAssessment,
  fetchAssessments,
  saveAssessment,
  saveAthleteProfile,
} from '@/lib/api'
import {
  SKINFOLD_SITES,
  bloodPressureClass,
  bmi,
  bmiClass,
  bodyComposition,
  stepTestVo2max,
  type Rating,
} from '@/lib/assessment'
import { describeError } from '@/lib/supabase'
import { ageOn, isoDate, num, parseIso, shortDate, signed } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { Assessment, AthleteProfile } from '@/lib/database.types'
import './assessments.css'

type NumericKey = {
  [K in keyof Assessment]: Assessment[K] extends number | null ? K : never
}[keyof Assessment]

const dmy = (value: string) => `${shortDate(value)} ${parseIso(value).getFullYear()}`

/** Um número sem zeros a mais: "72,5", "80". */
const short = (value: number | null | undefined, decimals = 1) =>
  value === null || value === undefined ? '—' : num(Number(value), decimals).replace(/,0+$/, '')

function Badge({ rating }: { rating: Rating | null }) {
  if (!rating) return null
  return (
    <span className={`chip ${rating.tone === 'default' ? '' : `chip--${rating.tone}`}`}>
      {rating.label}
    </span>
  )
}

/**
 * As avaliações físicas de um aluno. Mede-se, escreve-se, e o que é conta
 * faz-se sozinho: o IMC com a classificação, a % de massa gorda pelas três
 * pregas (Jackson & Pollock + Siri), a classificação da tensão e o VO2máx do
 * teste do banco.
 */
export function AssessmentsTab({
  athleteId,
  authorId,
  ficha,
  lastWeight,
  onFichaChanged,
}: {
  athleteId: string
  authorId: string
  ficha: AthleteProfile | null
  lastWeight: number | null
  /** A próxima avaliação também vive na ficha: quem a mudou aqui avisa. */
  onFichaChanged: () => void
}) {
  const { data, loading, error, reload } = useQuery(['avaliacoes', athleteId], () =>
    fetchAssessments(athleteId),
  )
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  if (loading) return <Loading label="A carregar as avaliações" />
  if (error) {
    return (
      <p className="error-banner">
        {error} Se as avaliações ainda não foram activadas na base de dados, falta
        aplicar a migração 15.
      </p>
    )
  }

  const list = data ?? []
  const ageAt = (date: string) =>
    ficha?.birth_date ? ageOn(ficha.birth_date, parseIso(date)) : null

  if (editing) {
    return (
      <AssessmentForm
        athleteId={athleteId}
        authorId={authorId}
        ficha={ficha}
        initial={editing === 'new' ? null : editing}
        seed={{
          height_cm: list[0]?.height_cm ?? ficha?.height_cm ?? null,
          weight_kg: lastWeight,
        }}
        onCancel={() => setEditing(null)}
        onDone={(fichaChanged) => {
          setEditing(null)
          reload()
          if (fichaChanged) onFichaChanged()
        }}
      />
    )
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--accent btn--block"
        onClick={() => setEditing('new')}
      >
        + Nova avaliação
      </button>

      {ficha?.next_update_date && (
        <p className="assess__next muted">
          Próxima avaliação marcada para <strong>{dmy(ficha.next_update_date)}</strong>.
        </p>
      )}

      {list.length === 0 ? (
        <section className="card card--flat">
          <span className="eyebrow">Avaliações</span>
          <p className="subtitle">
            Ainda sem avaliações. A primeira fica a servir de ponto de partida: as
            seguintes mostram a diferença para a anterior.
          </p>
        </section>
      ) : (
        <ul className="assess__list">
          {list.map((entry, index) => {
            const previous = list[index + 1] ?? null
            const open = openId === entry.id || (openId === null && index === 0)
            const imc = bmi(entry.weight_kg, entry.height_cm)
            const body = bodyComposition(entry, ficha?.sex, ageAt(entry.assessed_on))

            return (
              <li key={entry.id} className="card assess__item">
                <button
                  type="button"
                  className="assess__head"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? '' : entry.id)}
                >
                  <span className="assess__head-text">
                    <strong>{dmy(entry.assessed_on)}</strong>
                    <em>
                      {[
                        entry.weight_kg ? `${short(entry.weight_kg)} kg` : null,
                        imc ? `IMC ${num(imc, 1)}` : null,
                        body ? `${num(body.fatPercent, 1)}% MG` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'sem peso nem pregas'}
                    </em>
                  </span>
                  {index === 0 && <span className="chip chip--good">a mais recente</span>}
                </button>

                {open && (
                  <>
                    <AssessmentView
                      entry={entry}
                      previous={previous}
                      sex={ficha?.sex ?? null}
                      age={ageAt(entry.assessed_on)}
                      previousAge={previous ? ageAt(previous.assessed_on) : null}
                    />
                    <button
                      type="button"
                      className="btn btn--sm btn--quiet assess__edit"
                      onClick={() => setEditing(entry)}
                    >
                      Editar
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** Uma linha de resultado: o valor, a unidade e a diferença para a avaliação anterior. */
function Line({
  label,
  value,
  before,
  unit = '',
  decimals = 1,
  extra,
}: {
  label: string
  value: number | null | undefined
  before?: number | null
  unit?: string
  decimals?: number
  extra?: React.ReactNode
}) {
  if (value === null || value === undefined) return null
  const diff =
    before === null || before === undefined ? null : Number(value) - Number(before)
  return (
    <li>
      <span>{label}</span>
      <strong>
        {short(Number(value), decimals)}
        {unit ? ` ${unit}` : ''}
      </strong>
      {extra}
      <em>{diff === null || Math.abs(diff) < 0.05 ? '' : signed(diff, decimals)}</em>
    </li>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="assess__group">
      <span className="field__label">{title}</span>
      <ul className="assess__lines">{children}</ul>
    </div>
  )
}

function AssessmentView({
  entry,
  previous,
  sex,
  age,
  previousAge,
}: {
  entry: Assessment
  previous: Assessment | null
  sex: 'M' | 'F' | null
  age: number | null
  previousAge: number | null
}) {
  const imc = bmi(entry.weight_kg, entry.height_cm)
  const imcBefore = previous ? bmi(previous.weight_kg, previous.height_cm) : null
  const body = bodyComposition(entry, sex, age)
  const bodyBefore = previous ? bodyComposition(previous, sex, previousAge) : null
  const pressure = bloodPressureClass(entry.bp_systolic, entry.bp_diastolic)
  const vo2 = stepTestVo2max(sex, entry.step_test_hr)
  const vo2Before = previous ? stepTestVo2max(sex, previous.step_test_hr) : null
  const has = (...keys: NumericKey[]) => keys.some((key) => entry[key] !== null)
  const line = (label: string, key: NumericKey, unit: string, decimals = 1) => (
    <Line
      key={key}
      label={label}
      value={entry[key]}
      before={previous?.[key]}
      unit={unit}
      decimals={decimals}
    />
  )

  return (
    <div className="assess__view">
      {has('weight_kg', 'height_cm') && (
        <Group title="Peso e altura">
          {line('Peso', 'weight_kg', 'kg')}
          {line('Altura', 'height_cm', 'cm')}
          {imc !== null && (
            <Line
              label="IMC"
              value={imc}
              before={imcBefore}
              extra={<Badge rating={bmiClass(imc)} />}
            />
          )}
        </Group>
      )}

      {body && (
        <Group title="Composição corporal · 3 pregas">
          <Line label="Soma das pregas" value={body.sum} before={bodyBefore?.sum} unit="mm" />
          <Line label="Densidade corporal" value={body.density} decimals={4} />
          <Line
            label="Massa gorda"
            value={body.fatPercent}
            before={bodyBefore?.fatPercent}
            unit="%"
          />
          <Line label="Massa gorda" value={body.fatKg} before={bodyBefore?.fatKg} unit="kg" />
          <Line label="Massa magra" value={body.leanKg} before={bodyBefore?.leanKg} unit="kg" />
        </Group>
      )}

      {has('sf_chest_mm', 'sf_abdomen_mm', 'sf_thigh_mm', 'sf_triceps_mm', 'sf_suprailiac_mm') && (
        <Group title="Pregas adiposas">
          {line('Peito', 'sf_chest_mm', 'mm')}
          {line('Abdómen', 'sf_abdomen_mm', 'mm')}
          {line('Tricípite', 'sf_triceps_mm', 'mm')}
          {line('Supra-ilíaca', 'sf_suprailiac_mm', 'mm')}
          {line('Coxa', 'sf_thigh_mm', 'mm')}
        </Group>
      )}

      {has(
        'abdominal_cm',
        'hip_cm',
        'arm_r_cm',
        'arm_l_cm',
        'mid_thigh_r_cm',
        'mid_thigh_l_cm',
        'calf_r_cm',
        'calf_l_cm',
      ) && (
        <Group title="Perímetros">
          {line('Abdominal', 'abdominal_cm', 'cm')}
          {line('Anca', 'hip_cm', 'cm')}
          {line('Braço dto.', 'arm_r_cm', 'cm')}
          {line('Braço esq.', 'arm_l_cm', 'cm')}
          {line('Meia coxa dta.', 'mid_thigh_r_cm', 'cm')}
          {line('Meia coxa esq.', 'mid_thigh_l_cm', 'cm')}
          {line('Gémeo dto.', 'calf_r_cm', 'cm')}
          {line('Gémeo esq.', 'calf_l_cm', 'cm')}
        </Group>
      )}

      {has('bp_systolic', 'bp_diastolic', 'resting_hr') && (
        <Group title="Tensão arterial e frequência cardíaca">
          {entry.bp_systolic !== null && entry.bp_diastolic !== null && (
            <li>
              <span>Tensão</span>
              <strong>
                {entry.bp_systolic}/{entry.bp_diastolic} mmHg
              </strong>
              <Badge rating={pressure} />
            </li>
          )}
          {line('FC em repouso', 'resting_hr', 'bpm', 0)}
        </Group>
      )}

      {has('ankle_r_cm', 'ankle_l_cm') && (
        <Group title="Mobilidade do tornozelo · joelho à parede">
          {line('Direito', 'ankle_r_cm', 'cm')}
          {line('Esquerdo', 'ankle_l_cm', 'cm')}
        </Group>
      )}

      {has('grip_r_kg', 'grip_l_kg', 'push_ups', 'curl_ups', 'squat_test') && (
        <Group title="Aptidão neuromuscular">
          {line('Dinamometria dta.', 'grip_r_kg', 'kg')}
          {line('Dinamometria esq.', 'grip_l_kg', 'kg')}
          {line('Push-ups', 'push_ups', 'rep.', 0)}
          {line('Curl-ups', 'curl_ups', 'rep.', 0)}
          {line('Squat test', 'squat_test', 'rep.', 0)}
        </Group>
      )}

      {has('step_test_hr') && (
        <Group title="Aptidão cardiorrespiratória · Queen's College">
          {line('FC de recuperação', 'step_test_hr', 'bpm', 0)}
          {vo2 !== null && (
            <Line label="VO2máx estimado" value={vo2} before={vo2Before} unit="ml/kg/min" />
          )}
        </Group>
      )}

      {entry.next_on && (
        <p className="assess__note muted">Próxima avaliação: {dmy(entry.next_on)}</p>
      )}
      {entry.notes && <p className="assess__note">{entry.notes}</p>}
    </div>
  )
}

function AssessmentForm({
  athleteId,
  authorId,
  ficha,
  initial,
  seed,
  onDone,
  onCancel,
}: {
  athleteId: string
  authorId: string
  ficha: AthleteProfile | null
  initial: Assessment | null
  /** Com que números uma avaliação nova já vem preenchida. */
  seed: { height_cm: number | null; weight_kg: number | null }
  onDone: (fichaChanged: boolean) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<Assessment>>(
    initial ?? {
      assessed_on: isoDate(),
      height_cm: seed.height_cm,
      weight_kg: seed.weight_kg,
      next_on: null,
    },
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = (patch: Partial<Assessment>) => setForm((current) => ({ ...current, ...patch }))

  const sex = ficha?.sex ?? null
  const age =
    ficha?.birth_date && form.assessed_on
      ? ageOn(ficha.birth_date, parseIso(form.assessed_on))
      : null
  const imc = bmi(form.weight_kg, form.height_cm)
  const body = bodyComposition(form, sex, age)
  const pressure = bloodPressureClass(form.bp_systolic, form.bp_diastolic)
  const vo2 = stepTestVo2max(sex, form.step_test_hr)

  const field = (label: string, key: NumericKey, decimals = 1) => (
    <label className="field" key={key}>
      <span className="field__label">{label}</span>
      <NumberInput
        value={form[key]}
        decimals={decimals}
        onChange={(value) => set({ [key]: value })}
      />
    </label>
  )

  // Sem sexo na ficha não se sabe quais são as três pregas: mostram-se as cinco.
  const sites = sex
    ? SKINFOLD_SITES[sex]
    : [...SKINFOLD_SITES.M, ...SKINFOLD_SITES.F.slice(0, 2)]

  return (
    <section className="card assess__form">
      <span className="eyebrow">
        {initial ? `Avaliação de ${dmy(initial.assessed_on)}` : 'Nova avaliação'}
      </span>
      <p className="subtitle">
        Preenche só o que mediste hoje — o resto fica em branco e não aparece.
      </p>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Data</span>
          <input
            className="input"
            type="date"
            value={form.assessed_on ?? ''}
            onChange={(event) => set({ assessed_on: event.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Próxima avaliação</span>
          <input
            className="input"
            type="date"
            value={form.next_on ?? ''}
            onChange={(event) => set({ next_on: event.target.value || null })}
          />
        </label>
      </div>

      <h3 className="assess__title">Peso e altura</h3>
      <div className="grid-2">
        {field('Peso (kg)', 'weight_kg')}
        {field('Altura (cm)', 'height_cm')}
      </div>
      <div className="assess__result">
        <span>IMC</span>
        {imc !== null ? (
          <>
            <strong>{num(imc, 1)}</strong>
            <Badge rating={bmiClass(imc)} />
          </>
        ) : (
          <em>calcula-se com o peso e a altura</em>
        )}
      </div>

      <h3 className="assess__title">Perímetros (cm)</h3>
      <div className="grid-2">
        {field('Abdominal', 'abdominal_cm')}
        {field('Anca', 'hip_cm')}
        {field('Braço direito', 'arm_r_cm')}
        {field('Braço esquerdo', 'arm_l_cm')}
        {field('Meia coxa direita', 'mid_thigh_r_cm')}
        {field('Meia coxa esquerda', 'mid_thigh_l_cm')}
        {field('Gémeo direito', 'calf_r_cm')}
        {field('Gémeo esquerdo', 'calf_l_cm')}
      </div>

      <h3 className="assess__title">Pregas adiposas (mm)</h3>
      <p className="field__hint">
        {sex === 'M'
          ? 'Homem: peito, abdómen e coxa.'
          : sex === 'F'
            ? 'Mulher: tricípite, supra-ilíaca e coxa.'
            : 'Falta o sexo na ficha (Resumo → Quem é): é ele que diz quais são as três pregas.'}
      </p>
      <div className={sex ? 'grid-3' : 'grid-2'}>
        {sites.map((site) => field(site.label, site.key))}
      </div>
      <div className="assess__result">
        <span>Massa gorda</span>
        {body ? (
          <>
            <strong>{num(body.fatPercent, 1)}%</strong>
            <em>
              soma {short(body.sum)} mm · densidade {num(body.density, 4)}
              {body.fatKg !== null && body.leanKg !== null
                ? ` · ${num(body.fatKg, 1)} kg gorda, ${num(body.leanKg, 1)} kg magra`
                : ''}
            </em>
          </>
        ) : (
          <em>
            {!sex || age === null
              ? `falta na ficha: ${[!sex && 'sexo', age === null && 'data de nascimento'].filter(Boolean).join(' e ')}`
              : 'três pregas → densidade corporal → fórmula de Siri'}
          </em>
        )}
      </div>

      <h3 className="assess__title">Tensão arterial e frequência cardíaca</h3>
      <div className="grid-3">
        {field('Sistólica', 'bp_systolic', 0)}
        {field('Diastólica', 'bp_diastolic', 0)}
        {field('FC repouso', 'resting_hr', 0)}
      </div>
      <div className="assess__result">
        <span>Tensão</span>
        {pressure ? (
          <>
            <strong>
              {form.bp_systolic}/{form.bp_diastolic}
            </strong>
            <Badge rating={pressure} />
          </>
        ) : (
          <em>em mmHg; a frequência cardíaca em batimentos por minuto</em>
        )}
      </div>

      <h3 className="assess__title">Mobilidade do tornozelo (cm)</h3>
      <p className="field__hint">
        Teste do joelho à parede: a distância do dedo grande à parede, com o
        calcanhar no chão.
      </p>
      <div className="grid-2">
        {field('Direito', 'ankle_r_cm')}
        {field('Esquerdo', 'ankle_l_cm')}
      </div>

      <h3 className="assess__title">Aptidão neuromuscular</h3>
      <div className="grid-2">
        {field('Dinamometria dta. (kg)', 'grip_r_kg')}
        {field('Dinamometria esq. (kg)', 'grip_l_kg')}
      </div>
      <div className="grid-3">
        {field('Push-ups', 'push_ups', 0)}
        {field('Curl-ups', 'curl_ups', 0)}
        {field('Squat test', 'squat_test', 0)}
      </div>

      <h3 className="assess__title">Aptidão cardiorrespiratória</h3>
      <p className="field__hint">
        Queen's College step test: 3 minutos no banco de 41 cm (24 subidas por
        minuto no homem, 22 na mulher). Conta o pulso 15 segundos, dos 5 aos 20
        depois de parar, e multiplica por 4.
      </p>
      {field('FC de recuperação (bpm)', 'step_test_hr', 0)}
      <div className="assess__result">
        <span>VO2máx</span>
        {vo2 !== null ? (
          <>
            <strong>{num(vo2, 1)}</strong>
            <em>ml/kg/min, estimado</em>
          </>
        ) : (
          <em>{sex ? 'sai da frequência cardíaca de recuperação' : 'falta o sexo na ficha'}</em>
        )}
      </div>

      <label className="field">
        <span className="field__label">Notas</span>
        <textarea
          className="textarea"
          value={form.notes ?? ''}
          onChange={(event) => set({ notes: event.target.value || null })}
        />
      </label>

      {failure && <p className="error-banner">{failure}</p>}

      <div className="row">
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !form.assessed_on}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              await saveAssessment(athleteId, authorId, {
                ...form,
                assessed_on: form.assessed_on!,
              })
              // A próxima avaliação é a mesma data que a ficha mostra.
              const fichaChanged =
                Boolean(form.next_on) && form.next_on !== ficha?.next_update_date
              if (fichaChanged) {
                await saveAthleteProfile(athleteId, { next_update_date: form.next_on })
              }
              onDone(fichaChanged)
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : 'Guardar avaliação'}
        </button>
      </div>

      {initial && (
        <button
          type="button"
          className="btn btn--sm btn--quiet btn--danger assess__delete"
          onClick={async () => {
            if (!window.confirm('Apagar esta avaliação?')) return
            await deleteAssessment(initial.id)
            onDone(false)
          }}
        >
          Apagar esta avaliação
        </button>
      )}
    </section>
  )
}
