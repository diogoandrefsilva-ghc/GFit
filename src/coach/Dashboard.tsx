import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { AgendaRow, AgendaSheet } from '@/coach/Agenda'
import { ScheduleSheet } from '@/coach/ScheduleSheet'
import { Loading, ScreenHeader } from '@/components/Screen'
import {
  confirmPayment,
  fetchAthleteCalendar,
  fetchAthleteSummaries,
  fetchAttendance,
  fetchCoachCalendar,
  fetchDailyLog,
  fetchPendingPayments,
  fetchTrainingSlots,
  soft,
  type CalendarEntry,
} from '@/lib/api'
import { buildAgenda, presences, type AgendaItem } from '@/lib/agenda'
import { addDays, euros, isoDate, longDate, monthName, weekStart } from '@/lib/format'
import { athletesPath } from '@/lib/routes'
import { useQuery } from '@/lib/useQuery'
import type { DailyLog } from '@/lib/database.types'
import './dashboard.css'

/**
 * O Início do treinador responde a três perguntas, por esta ordem: o que
 * tenho hoje e nos próximos dias, o que está à minha espera, e como vai a
 * semana. Tudo o resto — a lista dos alunos, os pesos, quem registou o quê —
 * vive nos ecrãs que são disso.
 */
export function Dashboard() {
  const profile = useProfile()
  const navigate = useNavigate()
  const today = isoDate()
  const monday = weekStart(today)
  const sunday = addDays(monday, 6)
  /** A agenda mostra hoje e os seis dias seguintes. */
  const until = addDays(today, 6)

  const [scheduling, setScheduling] = useState(false)
  const [open, setOpen] = useState<AgendaItem | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // O dia entra na chave: o que o treinador registou de si é de hoje, e a
  // cache não pode servir amanhã o dia de ontem.
  const { data, loading, error, reload } = useQuery(
    ['inicio-treinador', profile.id, today],
    async () => {
      const [summaries, calendar, slots, attendance, payments, myLog, myCalendar] =
        await Promise.all([
          fetchAthleteSummaries(profile.id),
          fetchCoachCalendar(monday, until > sunday ? until : sunday),
          soft(fetchTrainingSlots(), []),
          soft(fetchAttendance(today, until), []),
          soft(fetchPendingPayments(), []),
          // O treinador também é aluno de si próprio: isto é o dia dele.
          fetchDailyLog(profile.id, today),
          fetchAthleteCalendar(profile.id, today, today),
        ])
      return { summaries, calendar, slots, attendance, payments, myLog, myCalendar }
    },
  )

  const view = useMemo(() => {
    const summaries = data?.summaries ?? []
    const athletes = summaries.map((summary) => summary.profile)
    const active = summaries.filter((s) => s.profile.status === 'active')
    const unread = summaries.filter((s) => s.unreadFeedback)
    const ending = summaries.filter((s) => s.plan && s.plan.num_weeks - s.week <= 1)

    const calendar = data?.calendar ?? []
    const agenda = buildAgenda(
      calendar.filter(
        (entry) =>
          entry.schedule.scheduled_on >= today && entry.schedule.scheduled_on <= until,
      ),
      presences(data?.slots ?? [], data?.attendance ?? [], today, until),
      athletes,
    )
    const days = [...new Set([today, ...agenda.map((item) => item.date)])]

    // A semana conta-se pelo que está marcado no calendário — é para lá que o
    // número leva —, e só os treinos dos alunos.
    const week = calendar.filter(
      (entry) =>
        entry.schedule.scheduled_on <= sunday && entry.schedule.athlete_id !== profile.id,
    )
    const weekDone = week.filter((entry) => entry.session?.status === 'done').length

    const payments = (data?.payments ?? []).filter((payment) => payment.paid_at)

    return { summaries, athletes, active, unread, ending, agenda, days, week, weekDone, payments }
  }, [data, today, until, sunday, profile.id])

  if (loading) return <Loading label="A carregar" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const firstName = (profile.full_name ?? '').split(' ')[0] || 'Treinador'
  const nameOf = (id: string) =>
    view.athletes.find((athlete) => athlete.id === id)?.full_name ?? 'Aluno'
  const pending = view.payments.length + view.unread.length + view.ending.length

  return (
    <div className="screen">
      <ScreenHeader eyebrow={longDate()} title={`Olá, ${firstName}`} />

      {view.summaries.length === 0 ? (
        <section className="card">
          <span className="eyebrow">Primeiro passo</span>
          <p className="subtitle">
            Ainda não tens alunos. Convida o primeiro no separador Perfil e ele
            aparece aqui assim que entrar.
          </p>
          <Link className="btn btn--primary btn--block" to="/perfil">
            Convidar aluno
          </Link>
        </section>
      ) : (
        <>
          {/* ── as duas coisas que se vêm cá fazer ─────── */}
          <div className="dash__actions">
            <button type="button" className="dash__action" onClick={() => setScheduling(true)}>
              <span className="dash__action-icon" aria-hidden="true">
                +
              </span>
              <strong>Marcar treino</strong>
              <em>para um aluno, num dia</em>
            </button>
            <Link className="dash__action" to="/treinos">
              <span className="dash__action-icon" aria-hidden="true">
                ✓
              </span>
              <strong>Treinos registados</strong>
              <em>o que os alunos fizeram</em>
            </Link>
          </div>

          {/* ── agenda ─────────────────────────────────── */}
          <section className="card">
            <div className="card__head">
              <span className="eyebrow">Próximos treinos</span>
              <Link className="dash__more" to="/calendario">
                calendário
              </Link>
            </div>
            <ul className="dash__days">
              {view.days.map((date) => {
                const items = view.agenda.filter((item) => item.date === date)
                return (
                  <li key={date} className="dash__day">
                    <span className={`dash__day-label ${date === today ? 'is-today' : ''}`}>
                      {date === today ? 'Hoje' : longDate(date)}
                    </span>
                    {items.length === 0 ? (
                      <p className="dash__day-empty muted">Sem treinos marcados para hoje.</p>
                    ) : (
                      items.map((item) => (
                        <AgendaRow
                          key={item.key}
                          item={item}
                          coachId={profile.id}
                          onOpen={() =>
                            item.kind === 'workout' &&
                            item.entry.schedule.athlete_id === profile.id
                              ? navigate('/eu?zona=treino')
                              : setOpen(item)
                          }
                        />
                      ))
                    )}
                  </li>
                )
              })}
            </ul>
            {view.agenda.length === 0 && (
              <p className="dash__agenda-hint muted">
                Nada marcado nos próximos sete dias. Usa o <strong>Marcar treino</strong>,
                ou define o dia de treino presencial na ficha de cada aluno.
              </p>
            )}
          </section>

          {/* ── o que está à espera do treinador ───────── */}
          {pending > 0 && (
            <section className="card card--accent">
              <span className="eyebrow">Por tratar · {pending}</span>
              <ul className="dash__list">
                {view.payments.map((payment) => (
                  <li key={payment.id}>
                    <div className="dash__row">
                      <span className="dash__row-text">
                        <strong>{nameOf(payment.athlete_id)}</strong>
                        <em>
                          diz que pagou {monthName(payment.period)} · {euros(payment.amount)}
                        </em>
                      </span>
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={busy === payment.id}
                        onClick={async () => {
                          setBusy(payment.id)
                          try {
                            await confirmPayment(
                              profile.id,
                              payment.athlete_id,
                              payment.period,
                              Number(payment.amount),
                            )
                            reload()
                          } finally {
                            setBusy(null)
                          }
                        }}
                      >
                        Validar
                      </button>
                    </div>
                  </li>
                ))}
                {view.unread.map((summary) => (
                  <li key={`f-${summary.profile.id}`}>
                    <Link className="dash__row" to={`/alunos/${summary.profile.id}`}>
                      <span className="dash__row-text">
                        <strong>{summary.profile.full_name}</strong>
                        <em>
                          feedback da semana {summary.unreadFeedback?.week_number} por ler
                        </em>
                      </span>
                      <span className="dash__go">→</span>
                    </Link>
                  </li>
                ))}
                {view.ending.map((summary) => (
                  <li key={`p-${summary.profile.id}`}>
                    <Link className="dash__row" to={`/alunos/${summary.profile.id}`}>
                      <span className="dash__row-text">
                        <strong>{summary.profile.full_name}</strong>
                        <em>
                          {summary.plan?.name} a acabar · semana {summary.week} de{' '}
                          {summary.plan?.num_weeks}
                        </em>
                      </span>
                      <span className="dash__go">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── a semana em dois números ───────────────── */}
          <div className="dash__tiles">
            <Tile
              label="Alunos"
              value={view.active.length}
              hint={
                view.summaries.length !== view.active.length
                  ? `${view.summaries.length - view.active.length} em pausa`
                  : 'activos'
              }
              to={athletesPath('todos')}
            />
            <Tile
              label="Treinos feitos"
              value={view.week.length > 0 ? `${view.weekDone}/${view.week.length}` : view.weekDone}
              hint={
                view.week.length > 0
                  ? 'dos marcados esta semana'
                  : 'nada marcado esta semana'
              }
              tone={
                view.week.length > 0 && view.weekDone >= view.week.length ? 'good' : 'default'
              }
              to="/treinos"
            />
          </div>
        </>
      )}

      {/* ── e o treino dele ────────────────────────── */}
      <SelfBanner log={data!.myLog} calendar={data!.myCalendar} />

      {scheduling && (
        <ScheduleSheet
          coachId={profile.id}
          athletes={view.athletes}
          onClose={() => setScheduling(false)}
          onDone={reload}
        />
      )}
      {open && (
        <AgendaSheet
          item={open}
          coachId={profile.id}
          from="/inicio"
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

/**
 * Um número do dia que leva a algum lado. O número continua a ser o que se lê
 * primeiro; o resto do cartão é só o que basta para se perceber que se toca.
 */
function Tile({
  label,
  value,
  hint,
  tone = 'default',
  to,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'good' | 'warn'
  to: string
}) {
  return (
    <Link className={`dash__tile dash__tile--${tone}`} to={to}>
      <span className="dash__tile-head">
        <span className="stat__label">{label}</span>
        <span className="dash__tile-go" aria-hidden="true">
          ›
        </span>
      </span>
      <strong className="dash__tile-value">{value}</strong>
      {hint && <span className="dash__tile-hint">{hint}</span>}
    </Link>
  )
}

/**
 * O treinador passa o dia a olhar para os números dos outros e esquece-se dos
 * dele. Este é o lembrete, no fim de tudo: o que lhe falta registar hoje, e a
 * porta para a sua área — onde os cartões de registo são os mesmos que os
 * alunos usam.
 *
 * Diz sempre o que falta, e não só "vai ali": quem já registou o dia não tem
 * de lá ir, e ver isso escrito vale mais do que um botão.
 */
function SelfBanner({
  log,
  calendar,
}: {
  log: DailyLog | null
  calendar: CalendarEntry[]
}) {
  const missing: string[] = []
  if (log?.weight_kg === null || log?.weight_kg === undefined) missing.push('peso')
  if (log?.sleep_hours === null || log?.sleep_hours === undefined) missing.push('sono')
  if (log?.steps === null || log?.steps === undefined) missing.push('passos')

  // Um treino marcado para hoje e ainda por fechar é o que manda no cartão:
  // é a única coisa aqui que tem hora para acontecer.
  const workout = calendar.find((entry) => entry.session?.status !== 'done') ?? null
  const workoutDone = calendar.length > 0 && workout === null
  const settled = missing.length === 0 && workout === null

  return (
    <Link
      className={`card dash__self ${settled ? 'card--good' : 'card--ink'}`}
      to={workout ? '/eu?zona=hoje' : '/eu'}
    >
      <span className="dash__self-text">
        <span className="eyebrow dash__self-eyebrow">O teu treino</span>
        <strong className="dash__self-title">
          {workout
            ? `Tens treino ${workout.day?.label ?? ''} marcado para hoje`
            : settled
              ? 'O teu dia está arrumado'
              : 'Falta registares o teu dia'}
        </strong>
        <em className="dash__self-meta">
          {missing.length > 0
            ? `por registar: ${missing.join(', ')}`
            : workout
              ? 'o registo do dia já está feito'
              : workoutDone
                ? 'treino feito · peso, sono e passos registados'
                : 'peso, sono e passos registados'}
        </em>
      </span>
      <span className="dash__self-go" aria-hidden="true">
        →
      </span>
    </Link>
  )
}
