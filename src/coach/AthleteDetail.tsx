import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import { Sparkline } from '@/components/Sparkline'
import { IdentityCard } from '@/coach/IdentityCard'
import { LimitationsCard } from '@/coach/LimitationsCard'
import { TargetsTab } from '@/coach/TargetsTab'
import {
  createPlan,
  fetchAthleteProfile,
  fetchCoachNotes,
  fetchCurrentTargets,
  fetchDietPlansFor,
  fetchFeedbackHistory,
  fetchLimitations,
  fetchMeasurements,
  fetchPlansFor,
  fetchRecentLogs,
  fetchTargetsHistory,
  replyToFeedback,
  saveCoachNote,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  WEIGHT_DIRECTION_LABEL,
  average,
  rollingAverage,
  weightTone,
} from '@/lib/calc'
import { hoursLabel, isoDate, num, relativeDate, shortDate, signed } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import type { AthleteTargets, WeeklyFeedback } from '@/lib/database.types'
import './athlete-detail.css'

type Tab = 'resumo' | 'metas' | 'planos'

export function AthleteDetail() {
  const coach = useProfile()
  const navigate = useNavigate()
  const { athleteId } = useParams<{ athleteId: string }>()
  const [tab, setTab] = useState<Tab>('resumo')

  const { data, loading, error, reload } = useQuery(['aluno', athleteId], async () => {
    const profiles = unwrap(
      await supabase.from('profiles').select('*').eq('id', athleteId!).limit(1),
    )
    const athlete = profiles[0]
    if (!athlete) throw new Error('Aluno não encontrado.')

    const [
      logs,
      measurements,
      plans,
      dietPlans,
      feedback,
      ficha,
      targets,
      targetsHistory,
      limitations,
      notes,
    ] = await Promise.all([
      fetchRecentLogs(athleteId!, 90),
      fetchMeasurements(athleteId!),
      fetchPlansFor(athleteId!),
      fetchDietPlansFor(athleteId!),
      fetchFeedbackHistory(athleteId!, 6),
      fetchAthleteProfile(athleteId!),
      fetchCurrentTargets(athleteId!),
      fetchTargetsHistory(athleteId!),
      fetchLimitations(athleteId!),
      fetchCoachNotes(athleteId!, 12),
    ])

    return {
      athlete,
      logs,
      measurements,
      plans,
      dietPlans,
      feedback,
      ficha,
      targets,
      targetsHistory,
      limitations,
      notes,
    }
  })

  if (loading) return <Loading label="A carregar aluno" />
  if (error || !data) {
    return (
      <div className="screen">
        <p className="error-banner">{error ?? 'Aluno não encontrado.'}</p>
      </div>
    )
  }

  const {
    athlete,
    logs,
    measurements,
    plans,
    dietPlans,
    feedback,
    ficha,
    targets,
    targetsHistory,
    limitations,
    notes,
  } = data

  return (
    <div className="screen">
      <ScreenHeader
        back
        eyebrow={athlete.email ?? undefined}
        title={athlete.full_name ?? 'Aluno'}
        action={<Avatar name={athlete.full_name} url={athlete.avatar_url} size={40} />}
      />

      <div className="row detail__tabs">
        {(
          [
            ['resumo', 'Resumo'],
            ['metas', 'Metas'],
            ['planos', 'Planos'],
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
          <IdentityCard athleteId={athlete.id} ficha={ficha} onSaved={reload} />

          <WeightCard logs={logs} measurements={measurements} targets={targets} />

          <section className="card">
            <span className="eyebrow">Bem-estar · última semana</span>
            <div className="row">
              <Stat
                label="Sono"
                value={hoursLabel(average(logs.slice(-7).map((log) => log.sleep_hours)))}
              />
              <Stat
                label="Energia"
                value={scale(average(logs.slice(-7).map((log) => log.energy)))}
              />
            </div>
            <div className="row">
              <Stat
                label="Fome"
                value={scale(average(logs.slice(-7).map((log) => log.hunger)))}
              />
              <Stat
                label="Stress"
                value={scale(average(logs.slice(-7).map((log) => log.stress)))}
              />
            </div>
          </section>

          <LimitationsCard
            athleteId={athlete.id}
            coachId={coach.id}
            limitations={limitations}
            onChanged={reload}
          />

          <NotesCard
            coachId={coach.id}
            athleteId={athlete.id}
            notes={notes}
            onSaved={reload}
          />

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
                    ['Cintura', measurements[0].waist_cm, measurements[1]?.waist_cm],
                    ['Glúteo', measurements[0].glute_cm, measurements[1]?.glute_cm],
                    ['Coxa drt.', measurements[0].thigh_r_cm, measurements[1]?.thigh_r_cm],
                    ['Braço drt.', measurements[0].arm_r_cm, measurements[1]?.arm_r_cm],
                    ['Gémeo drt.', measurements[0].calf_r_cm, measurements[1]?.calf_r_cm],
                  ] as const
                )
                  .filter(([, value]) => value !== null && value !== undefined)
                  .map(([label, value, before]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>{num(value, 1)} cm</strong>
                      <em>
                        {before !== null && before !== undefined
                          ? signed(Number(value) - Number(before))
                          : ''}
                      </em>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'metas' && (
        <TargetsTab
          athleteId={athlete.id}
          coachId={coach.id}
          current={targets}
          history={targetsHistory}
          onChanged={reload}
        />
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
                        kcal_target: targets?.kcal_target ?? null,
                        protein_target_g: targets?.protein_target_g ?? null,
                        fat_target_g: targets?.fat_target_g ?? null,
                        carb_target_g: targets?.carb_target_g ?? null,
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
                        <em>{plan.kcal_target ? `${plan.kcal_target} kcal` : 'sem meta'}</em>
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
    </div>
  )
}

function scale(value: number | null): string {
  return value === null ? '—' : `${num(value, 1)} / 5`
}

/**
 * Peso de hoje, a variação desde a pesagem anterior e a tendência. O valor vem
 * do último registo diário do aluno, não de um campo que alguém tenha de
 * escrever à mão.
 */
function WeightCard({
  logs,
  measurements,
  targets,
}: {
  logs: { log_date: string; weight_kg: number | null }[]
  measurements: { measured_on: string; weight_kg: number | null }[]
  targets: AthleteTargets | null
}) {
  const weighed = logs.filter((log) => log.weight_kg !== null)
  const latest = weighed[weighed.length - 1] ?? null
  const previous = weighed[weighed.length - 2] ?? null

  // A comparação que interessa é com a pesagem oficial anterior; sem ela,
  // serve o registo diário anterior.
  const baseline =
    measurements.find((m) => m.weight_kg !== null && m.measured_on !== latest?.log_date) ??
    (previous ? { measured_on: previous.log_date, weight_kg: previous.weight_kg } : null)

  const change =
    latest?.weight_kg != null && baseline?.weight_kg != null
      ? Number(latest.weight_kg) - Number(baseline.weight_kg)
      : null

  const toTarget =
    latest?.weight_kg != null && targets?.weight_target_kg != null
      ? Number(targets.weight_target_kg) - Number(latest.weight_kg)
      : null

  const series = logs.map((log) => log.weight_kg)

  return (
    <section className="card">
      <div className="card__head">
        <span className="eyebrow">Peso</span>
        {latest && (
          <span className="muted detail__weight-when">
            {relativeDate(latest.log_date)}
          </span>
        )}
      </div>

      <div className="detail__weight-row">
        <strong className="detail__weight">
          {latest?.weight_kg != null ? `${num(latest.weight_kg, 1)} kg` : '—'}
        </strong>
        {change !== null && (
          <span
            className={`detail__delta ${
              weightTone(change, targets?.weight_direction) === 'good' ? 'is-good' : ''
            }`}
          >
            {change < 0 ? '▼' : change > 0 ? '▲' : '='} {signed(change)} kg
          </span>
        )}
        {targets?.weight_direction && (
          <span className="detail__direction muted">
            {WEIGHT_DIRECTION_LABEL[targets.weight_direction].toLowerCase()}
          </span>
        )}
      </div>

      {baseline && change !== null && (
        <p className="detail__weight-note muted">
          face a {num(baseline.weight_kg, 1)} kg em {shortDate(baseline.measured_on)}
        </p>
      )}

      <Sparkline
        values={series}
        overlay={rollingAverage(series, 7)}
        label="Peso do aluno"
      />

      {toTarget !== null && (
        <div className="row">
          <Stat
            label="Meta"
            value={`${num(targets?.weight_target_kg, 1)} kg`}
            hint={`faltam ${num(Math.abs(toTarget), 1)} kg`}
            tone={Math.abs(toTarget) <= 0.5 ? 'good' : 'default'}
          />
        </div>
      )}
    </section>
  )
}

/** Notas do dia, com o rasto do que já foi dito. */
function NotesCard({
  coachId,
  athleteId,
  notes,
  onSaved,
}: {
  coachId: string
  athleteId: string
  notes: { id: string; note_date: string; body: string; read_at: string | null }[]
  onSaved: () => void
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? notes : notes.slice(0, 3)

  return (
    <section className="card card--accent">
      <span className="eyebrow">Notas e conselhos</span>
      <p className="subtitle">A mais recente aparece no ecrã "Hoje" do aluno.</p>

      <textarea
        className="textarea"
        value={body}
        placeholder="Hoje sobe 2,5 kg no supino. Se a perna incomodar, avisa-me."
        onChange={(event) => setBody(event.target.value)}
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
            onSaved()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A enviar…' : 'Enviar nota'}
      </button>

      {notes.length > 0 && (
        <ul className="detail__notes">
          {visible.map((note) => (
            <li key={note.id}>
              <span className="detail__note-date">
                {shortDate(note.note_date)}
                {note.read_at ? ' · lida' : ''}
              </span>
              <p>{note.body}</p>
            </li>
          ))}
          {notes.length > 3 && (
            <li>
              <button
                type="button"
                className="detail__more"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'mostrar menos' : `ver as ${notes.length} notas`}
              </button>
            </li>
          )}
        </ul>
      )}
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
