import { useState } from 'react'
import { NumberInput } from '@/components/NumberInput'
import { saveAthleteProfile } from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { ACTIVITY_LEVELS, energyOf } from '@/lib/calc'
import { ageOn, int, isoDate, nextMonthlyDate, num, shortDate } from '@/lib/format'
import type { AthleteProfile } from '@/lib/database.types'
import './ficha.css'

/** "15/11/2026" */
const dmy = (value: string) => value.split('-').reverse().join('/')

/**
 * O pack é mensal e renova sozinho: a data guardada é a âncora, e o que se
 * mostra é a próxima renovação. Com a renovação desligada, é o fim.
 */
function packLine(ficha: AthleteProfile): string | null {
  if (!ficha.pack_end_date) return ficha.pack_renews_monthly ? 'Pack mensal' : null
  if (ficha.pack_renews_monthly) {
    return `Pack mensal · renova a ${dmy(nextMonthlyDate(ficha.pack_end_date))}`
  }
  return ficha.pack_end_date < isoDate()
    ? `Pack acabou a ${dmy(ficha.pack_end_date)}`
    : `Pack até ${dmy(ficha.pack_end_date)}`
}

/**
 * O que quase não muda no aluno: nascimento, sexo, altura, peso, actividade,
 * profissão — e, a partir deles, a taxa metabólica basal. Fica em cima do
 * resumo porque é o contexto com que se lê tudo o resto, e é curto o suficiente
 * para não justificar um separador só para si.
 */
export function IdentityCard({
  athleteId,
  ficha,
  lastWeight = null,
  onSaved,
}: {
  athleteId: string
  ficha: AthleteProfile | null
  /** O último peso registado, para a TMB quando a ficha não tem peso. */
  lastWeight?: number | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<AthleteProfile>>(ficha ?? {})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = (patch: Partial<AthleteProfile>) =>
    setForm((current) => ({ ...current, ...patch }))

  if (!editing) {
    const energy = energyOf(ficha, lastWeight)
    const activity = ACTIVITY_LEVELS.find(
      (level) => level.value === Number(ficha?.activity_level),
    )
    const facts: [string, string][] = [
      [
        'Idade',
        ficha?.birth_date ? `${ageOn(ficha.birth_date)} anos` : '—',
      ],
      ['Sexo', ficha?.sex === 'M' ? 'Masculino' : ficha?.sex === 'F' ? 'Feminino' : '—'],
      ['Altura', ficha?.height_cm ? `${num(ficha.height_cm, 0)} cm` : '—'],
      [
        ficha?.start_weight_kg || !energy.weight ? 'Peso' : 'Peso · registado',
        energy.weight ? `${num(Number(energy.weight), 1).replace(/,0$/, '')} kg` : '—',
      ],
      ['Atividade', activity?.label ?? '—'],
      ['Profissão', ficha?.occupation || '—'],
    ]
    const pack = ficha ? packLine(ficha) : null

    return (
      <section className="card">
        <div className="card__head">
          <span className="eyebrow">Quem é</span>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => {
              setForm(ficha ?? {})
              setEditing(true)
            }}
          >
            {ficha ? 'Editar' : 'Preencher'}
          </button>
        </div>
        <ul className="identity">
          {facts.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>

        {/* A TMB faz-se sozinha a partir do que está em cima, como na folha
            "Base" — e diz o que falta quando não chega. */}
        <div className="identity__energy">
          {energy.bmr ? (
            <>
              <div>
                <span>Taxa metabólica basal</span>
                <strong>{int(energy.bmr)} kcal</strong>
              </div>
              <div>
                <span>
                  Gasto do dia
                  {ficha?.activity_level
                    ? ` · × ${num(Number(ficha.activity_level), 3).replace(/0+$/, '')}`
                    : ''}
                </span>
                <strong>{energy.daily ? `${int(energy.daily)} kcal` : '—'}</strong>
              </div>
              {!energy.daily && (
                <p className="identity__energy-note muted">
                  Escolhe o nível de atividade para ter o gasto do dia.
                </p>
              )}
            </>
          ) : (
            <p className="identity__energy-note muted">
              Taxa metabólica basal: falta {energy.missing.join(', ')}.
            </p>
          )}
        </div>

        {pack && <p className="identity__pack muted">{pack}</p>}
      </section>
    )
  }

  return (
    <section className="card">
      <span className="eyebrow">Quem é</span>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Data de nascimento</span>
          <input
            className="input"
            type="date"
            max="2026-12-31"
            value={form.birth_date ?? ''}
            onChange={(event) => set({ birth_date: event.target.value || null })}
          />
          <span className="field__hint">dia / mês / ano</span>
        </label>

        <label className="field">
          <span className="field__label">Altura (cm)</span>
          <NumberInput
            value={form.height_cm}
            decimals={0}
            onChange={(value) => set({ height_cm: value })}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Peso (kg)</span>
        <NumberInput
          value={form.start_weight_kg}
          placeholder={lastWeight ? `último registo: ${num(lastWeight, 1)}` : undefined}
          onChange={(value) => set({ start_weight_kg: value })}
        />
        <span className="field__hint">
          é o peso da taxa metabólica basal; sem ele, conta o último registado
        </span>
      </label>

      <div className="field">
        <span className="field__label">Nível de atividade física</span>
        <div className="activity-levels">
          {ACTIVITY_LEVELS.map((level) => {
            const on = Number(form.activity_level) === level.value
            return (
              <button
                key={level.value}
                type="button"
                className={`activity-level ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() => set({ activity_level: on ? null : level.value })}
              >
                <strong>
                  {level.label} <em>× {num(level.value, 3).replace(/0+$/, '')}</em>
                </strong>
                <span>{level.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Sexo</span>
        <div className="row">
          {(
            [
              ['M', 'Masculino'],
              ['F', 'Feminino'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${form.sex === value ? 'chip--on' : ''}`}
              onClick={() => set({ sex: form.sex === value ? null : value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Profissão / ocupação</span>
        <input
          className="input"
          value={form.occupation ?? ''}
          placeholder="Escritório, turnos, trabalho físico…"
          onChange={(event) => set({ occupation: event.target.value || null })}
        />
      </label>

      <div className="field">
        <span className="field__label">Pack</span>
        <div className="row">
          {(
            [
              [true, 'Mensal, renova sozinho'],
              [false, 'Acaba numa data'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              className={`chip ${(form.pack_renews_monthly ?? true) === value ? 'chip--on' : ''}`}
              onClick={() => set({ pack_renews_monthly: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">
            {(form.pack_renews_monthly ?? true) ? 'Renova a' : 'Fim do pack'}
          </span>
          <input
            className="input"
            type="date"
            value={form.pack_end_date ?? ''}
            onChange={(event) => set({ pack_end_date: event.target.value || null })}
          />
          <span className="field__hint">
            {(form.pack_renews_monthly ?? true)
              ? form.pack_end_date
                ? `todos os meses a dia ${Number(form.pack_end_date.slice(8))} · próxima ${shortDate(nextMonthlyDate(form.pack_end_date))}`
                : 'o dia do mês em que renova'
              : 'quando acaba o acompanhamento'}
          </span>
        </label>

        <label className="field">
          <span className="field__label">Próxima avaliação</span>
          <input
            className="input"
            type="date"
            value={form.next_update_date ?? ''}
            onChange={(event) => set({ next_update_date: event.target.value || null })}
          />
          <span className="field__hint">medidas e fotos</span>
        </label>
      </div>

      {failure && <p className="error-banner">{failure}</p>}

      <div className="row">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            setFailure(null)
            setEditing(false)
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              await saveAthleteProfile(athleteId, form)
              setEditing(false)
              onSaved()
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}
