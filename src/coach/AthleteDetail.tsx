import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import { Sparkline } from '@/components/Sparkline'
import {
  createPlan,
  fetchAthleteProfile,
  fetchDietPlansFor,
  fetchFeedbackHistory,
  fetchMeasurements,
  fetchPlansFor,
  fetchRecentLogs,
  replyToFeedback,
  saveAthleteProfile,
  saveCoachNote,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { average, rollingAverage } from '@/lib/calc'
import { hoursLabel, isoDate, num, shortDate, signed } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import type { AthleteProfile, WeeklyFeedback } from '@/lib/database.types'
import './athlete-detail.css'

type Tab = 'resumo' | 'planos' | 'ficha'

export function AthleteDetail() {
  const coach = useProfile()
  const navigate = useNavigate()
  const { athleteId } = useParams<{ athleteId: string }>()
  const [tab, setTab] = useState<Tab>('resumo')

  const { data, loading, error, reload } = useQuery(async () => {
    const profiles = unwrap(
      await supabase.from('profiles').select('*').eq('id', athleteId!).limit(1),
    )
    const athlete = profiles[0]
    if (!athlete) throw new Error('Aluno não encontrado.')

    const [logs, measurements, plans, dietPlans, feedback, ficha] = await Promise.all([
      fetchRecentLogs(athleteId!, 90),
      fetchMeasurements(athleteId!),
      fetchPlansFor(athleteId!),
      fetchDietPlansFor(athleteId!),
      fetchFeedbackHistory(athleteId!, 6),
      fetchAthleteProfile(athleteId!),
    ])

    return { athlete, logs, measurements, plans, dietPlans, feedback, ficha }
  }, [athleteId])

  if (loading) return <Loading label="A carregar aluno" />
  if (error || !data) {
    return (
      <div className="screen">
        <p className="error-banner">{error ?? 'Aluno não encontrado.'}</p>
      </div>
    )
  }

  const { athlete, logs, measurements, plans, dietPlans, feedback, ficha } = data

  const weights = logs.map((log) => log.weight_kg)
  const present = weights.filter((value): value is number => value !== null)
  const change = present.length > 1 ? present[present.length - 1] - present[0] : null

  return (
    <div className="screen">
      <ScreenHeader
        back
        eyebrow={athlete.email ?? undefined}
        title={athlete.full_name ?? 'Aluno'}
        action={
          <Avatar name={athlete.full_name} url={athlete.avatar_url} size={40} />
        }
      />

      <div className="row detail__tabs">
        {(
          [
            ['resumo', 'Resumo'],
            ['planos', 'Planos'],
            ['ficha', 'Ficha'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip ${tab === key ? 'chip--on' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumo' && (
        <>
          <section className="card">
            <div className="card__head">
              <span className="eyebrow">Peso</span>
              <strong className="detail__weight">
                {present.length ? `${num(present[present.length - 1], 1)} kg` : '—'}
              </strong>
            </div>
            <Sparkline
              values={weights}
              overlay={rollingAverage(weights, 7)}
              label="Peso do aluno"
            />
            <div className="row">
              <Stat
                label="Variação"
                value={change !== null ? `${signed(change)} kg` : '—'}
                hint="90 dias"
              />
              <Stat
                label="Sono médio"
                value={hoursLabel(average(logs.slice(-7).map((log) => log.sleep_hours)))}
                hint="última semana"
              />
            </div>
            <div className="row">
              <Stat
                label="Energia"
                value={fmtScale(average(logs.slice(-7).map((log) => log.energy)))}
              />
              <Stat
                label="Fome"
                value={fmtScale(average(logs.slice(-7).map((log) => log.hunger)))}
              />
              <Stat
                label="Stress"
                value={fmtScale(average(logs.slice(-7).map((log) => log.stress)))}
              />
            </div>
          </section>

          <NoteComposer coachId={coach.id} athleteId={athlete.id} />

          <section className="card">
            <span className="eyebrow">Feedback semanal</span>
            {feedback.length === 0 ? (
              <p className="subtitle">Ainda sem feedback enviado.</p>
            ) : (
              <ul className="detail__feedback">
                {feedback.map((entry) => (
                  <FeedbackCard key={entry.id} entry={entry} onReplied={reload} />
                ))}
              </ul>
            )}
          </section>

          {measurements.length > 0 && (
            <section className="card card--flat">
              <span className="eyebrow">
                Perímetros · {shortDate(measurements[0].measured_on)}
              </span>
              <ul className="detail__perimeters">
                {(
                  [
                    ['Cintura', measurements[0].waist_cm],
                    ['Glúteo', measurements[0].glute_cm],
                    ['Coxa drt.', measurements[0].thigh_r_cm],
                    ['Braço drt.', measurements[0].arm_r_cm],
                    ['Gémeo drt.', measurements[0].calf_r_cm],
                  ] as const
                )
                  .filter(([, value]) => value !== null)
                  .map(([label, value]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>{num(value, 1)} cm</strong>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'planos' && (
        <>
          <section className="card">
            <div className="card__head">
              <span className="eyebrow">Planos de treino</span>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={async () => {
                  const plan = await createPlan(coach.id, athlete.id, {
                    name: `Plano ${plans.length + 1}`,
                    block_name: null,
                    num_weeks: 4,
                    start_date: isoDate(),
                  })
                  navigate(`/planos/${plan.id}`)
                }}
              >
                + Novo plano
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="subtitle">Ainda sem planos.</p>
            ) : (
              <ul className="detail__plans">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <Link to={`/planos/${plan.id}`} className="detail__plan">
                      <span className="detail__plan-name">
                        <strong>{plan.name}</strong>
                        <em>
                          {plan.num_weeks} semanas · início {shortDate(plan.start_date)}
                        </em>
                      </span>
                      <span
                        className={`chip ${
                          plan.status === 'published' ? 'chip--good' : 'chip--accent'
                        }`}
                      >
                        {plan.status === 'published' ? 'publicado' : 'rascunho'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <span className="eyebrow">Planos alimentares</span>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={async () => {
                  const rows = unwrap(
                    await supabase
                      .from('diet_plans')
                      .insert({
                        athlete_id: athlete.id,
                        coach_id: coach.id,
                        name: `Plano alimentar ${dietPlans.length + 1}`,
                        kcal_target: ficha?.kcal_target ?? null,
                        protein_target_g: ficha?.protein_target_g ?? null,
                        fat_target_g: ficha?.fat_target_g ?? null,
                        carb_target_g: ficha?.carb_target_g ?? null,
                      })
                      .select(),
                  )
                  navigate(`/dietas/${rows[0].id}`)
                }}
              >
                + Nova dieta
              </button>
            </div>
            {dietPlans.length === 0 ? (
              <p className="subtitle">Ainda sem planos alimentares.</p>
            ) : (
              <ul className="detail__plans">
                {dietPlans.map((plan) => (
                  <li key={plan.id}>
                    <Link to={`/dietas/${plan.id}`} className="detail__plan">
                      <span className="detail__plan-name">
                        <strong>{plan.name}</strong>
                        <em>
                          {plan.kcal_target ? `${plan.kcal_target} kcal` : 'sem meta'}
                        </em>
                      </span>
                      <span
                        className={`chip ${
                          plan.status === 'published' ? 'chip--good' : 'chip--accent'
                        }`}
                      >
                        {plan.status === 'published' ? 'publicado' : 'rascunho'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'ficha' && (
        <AthleteForm athleteId={athlete.id} initial={ficha} onSaved={reload} />
      )}
    </div>
  )
}

function fmtScale(value: number | null): string {
  return value === null ? '—' : `${num(value, 1)} / 5`
}

function NoteComposer({
  coachId,
  athleteId,
}: {
  coachId: string
  athleteId: string
}) {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <section className="card card--accent">
      <span className="eyebrow">Nota para o aluno</span>
      <p className="subtitle">Aparece no ecrã "Hoje" dele.</p>
      <textarea
        className="textarea"
        value={body}
        placeholder="Hoje sobe 2,5 kg no supino. Se a perna incomodar, avisa-me."
        onChange={(event) => {
          setBody(event.target.value)
          setSent(false)
        }}
      />
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || body.trim().length === 0}
        onClick={async () => {
          setBusy(true)
          try {
            await saveCoachNote(coachId, athleteId, body.trim())
            setBody('')
            setSent(true)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A enviar…' : sent ? 'Enviada ✓' : 'Enviar nota'}
      </button>
    </section>
  )
}

function FeedbackCard({
  entry,
  onReplied,
}: {
  entry: WeeklyFeedback
  onReplied: () => void
}) {
  const [reply, setReply] = useState(entry.coach_reply ?? '')
  const [open, setOpen] = useState(!entry.read_at)
  const [busy, setBusy] = useState(false)

  return (
    <li className={`feedback-card ${entry.read_at ? '' : 'is-unread'}`}>
      <button
        type="button"
        className="feedback-card__head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>
          <strong>Semana {entry.week_number}</strong>
          <em>{shortDate(entry.week_start)}</em>
        </span>
        {!entry.read_at && <span className="chip chip--accent">por ler</span>}
      </button>

      {open && (
        <div className="feedback-card__body">
          {(
            [
              ['Em geral', entry.overall],
              ['Correu bem', entry.went_well],
              ['Dificuldades', entry.difficulties],
              ['Próxima semana', entry.next_week],
            ] as const
          )
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="feedback-card__item">
                <span className="field__label">{label}</span>
                <p>{value}</p>
              </div>
            ))}

          <div className="row row--wrap">
            {entry.motivation && (
              <span className="chip">motivação {entry.motivation}/10</span>
            )}
            {entry.diet_adherence !== null && (
              <span className="chip">dieta {entry.diet_adherence}%</span>
            )}
            {entry.trainings_done !== null && (
              <span className="chip">
                {entry.trainings_done}/{entry.trainings_planned} treinos
              </span>
            )}
          </div>

          <label className="field">
            <span className="field__label">Resposta</span>
            <textarea
              className="textarea"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={busy || reply.trim().length === 0}
            onClick={async () => {
              setBusy(true)
              try {
                await replyToFeedback(entry.id, reply.trim())
                onReplied()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'A enviar…' : 'Responder'}
          </button>
        </div>
      )}
    </li>
  )
}

function AthleteForm({
  athleteId,
  initial,
  onSaved,
}: {
  athleteId: string
  initial: AthleteProfile | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<Partial<AthleteProfile>>(initial ?? {})
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<AthleteProfile>) =>
    setForm((current) => ({ ...current, ...patch }))

  const numberOrNull = (value: string) => (value === '' ? null : Number(value))

  return (
    <section className="card">
      <span className="eyebrow">Ficha do aluno</span>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Altura (cm)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={form.height_cm ?? ''}
            onChange={(event) => set({ height_cm: numberOrNull(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field__label">Data de nascimento</span>
          <input
            className="input"
            type="date"
            value={form.birth_date ?? ''}
            onChange={(event) => set({ birth_date: event.target.value || null })}
          />
        </label>
        <label className="field">
          <span className="field__label">Meta de passos</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={form.steps_goal ?? ''}
            onChange={(event) => set({ steps_goal: numberOrNull(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field__label">Fim do pack</span>
          <input
            className="input"
            type="date"
            value={form.pack_end_date ?? ''}
            onChange={(event) => set({ pack_end_date: event.target.value || null })}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Objetivo</span>
        <textarea
          className="textarea"
          value={form.goal ?? ''}
          onChange={(event) => set({ goal: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Limitações</span>
        <textarea
          className="textarea"
          placeholder="Lesões, condições, o que evitar"
          value={form.limitations ?? ''}
          onChange={(event) => set({ limitations: event.target.value })}
        />
      </label>

      <span className="eyebrow">Metas diárias</span>
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Kcal</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={form.kcal_target ?? ''}
            onChange={(event) => set({ kcal_target: numberOrNull(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field__label">Proteína (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={form.protein_target_g ?? ''}
            onChange={(event) =>
              set({ protein_target_g: numberOrNull(event.target.value) })
            }
          />
        </label>
        <label className="field">
          <span className="field__label">Gordura (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={form.fat_target_g ?? ''}
            onChange={(event) => set({ fat_target_g: numberOrNull(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field__label">Hidratos (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={form.carb_target_g ?? ''}
            onChange={(event) => set({ carb_target_g: numberOrNull(event.target.value) })}
          />
        </label>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await saveAthleteProfile(athleteId, form)
            onSaved()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A guardar…' : 'Guardar ficha'}
      </button>
    </section>
  )
}
