import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Sheet } from '@/components/Sheet'
import {
  answerProposal,
  fetchSchedulablePlans,
  isSelfPlan,
  startSession,
  unscheduleWorkout,
  type CalendarEntry,
} from '@/lib/api'
import type { AgendaItem } from '@/lib/agenda'
import { describeError } from '@/lib/supabase'
import { isoDate, longDate, plural } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { Plan, Profile } from '@/lib/database.types'
import './agenda.css'

function athleteOf(item: AgendaItem): Profile | null {
  return item.kind === 'workout' ? item.entry.athlete : item.athlete
}

function workoutName(entry: CalendarEntry): string {
  return `Treino ${entry.day?.label ?? '?'}${entry.day?.title ? ` · ${entry.day.title}` : ''}`
}

/**
 * Uma linha da agenda: quem, o quê, a que horas, e em que pé está. Serve o
 * Início e o Calendário, para um treino se ler da mesma maneira nos dois.
 */
export function AgendaRow({
  item,
  coachId,
  onOpen,
}: {
  item: AgendaItem
  coachId: string
  onOpen: () => void
}) {
  const athlete = athleteOf(item)
  const today = isoDate()
  let name = athlete?.full_name ?? athlete?.email ?? 'Aluno'
  let meta: string
  let chip: { text: string; tone: '' | 'good' | 'accent' | 'warn' } | null = null

  if (item.kind === 'presence') {
    meta = `Presencial${item.time ? ` · ${item.time}` : ''}`
    if (item.presence.status === 'not_going') chip = { text: 'não vai', tone: 'warn' }
    else if (item.presence.status === 'proposed') chip = { text: 'propõe outra data', tone: 'accent' }
    else if (item.presence.status === 'moved') chip = { text: 'data nova', tone: '' }
    else if (item.presence.attendance) chip = { text: 'vai', tone: 'good' }
  } else {
    const { entry } = item
    if (entry.schedule.athlete_id === coachId) name = 'Eu'
    else if (entry.plan && isSelfPlan(entry.plan)) name = `${name} · auto`
    meta = [
      item.time || null,
      workoutName(entry),
      plural(entry.exerciseCount, 'exercício', 'exercícios'),
    ]
      .filter(Boolean)
      .join(' · ')
    if (entry.session?.status === 'done') chip = { text: 'feito', tone: 'good' }
    else if (entry.session?.status === 'in_progress') chip = { text: 'a meio', tone: 'accent' }
    else if (item.date < today) chip = { text: 'em falta', tone: '' }
  }

  return (
    <button type="button" className="agenda-row" onClick={onOpen}>
      <Avatar name={athlete?.full_name} url={athlete?.avatar_url} size={32} />
      <span className="agenda-row__text">
        <strong>{name}</strong>
        <em>{meta}</em>
      </span>
      {chip ? (
        <span className={`chip ${chip.tone ? `chip--${chip.tone}` : ''}`}>{chip.text}</span>
      ) : (
        <span className="agenda-row__go" aria-hidden="true">
          ›
        </span>
      )}
    </button>
  )
}

/**
 * O que se faz com uma linha da agenda. O que interessa mais vem primeiro:
 * num treino presencial é o treinador que tem o telemóvel na mão, e é ele que
 * regista as séries do aluno.
 */
export function AgendaSheet({
  item,
  coachId,
  from,
  onClose,
  onChanged,
}: {
  item: AgendaItem
  coachId: string
  /** O ecrã de onde se veio, para o treino saber para onde voltar. */
  from: string
  onClose: () => void
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const athlete = athleteOf(item)
  const athleteId =
    item.kind === 'workout' ? item.entry.schedule.athlete_id : item.presence.slot.athlete_id
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  /** No treino marcado: a lista dos outros treinos do aluno, para dar outro. */
  const [others, setOthers] = useState(false)

  // Numa sessão presencial o treino não vem marcado: escolhe-se dos planos do aluno.
  const { data: plans, loading } = useQuery(
    ['marcar-planos', athleteId, coachId],
    () => fetchSchedulablePlans(athleteId, coachId),
    { persist: false },
  )

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await action()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  const register = (plan: Plan, dayId: string, entry?: CalendarEntry) =>
    run(async () => {
      const session =
        entry?.session ?? (await startSession(athleteId, plan, dayId, entry?.schedule))
      navigate(`/treino/${session.id}`, { state: { from } })
    })

  const when = `${longDate(item.date).toLowerCase()}${item.time ? ` · ${item.time}` : ''}`
  const ficha = (
    <button
      type="button"
      className="btn btn--quiet btn--block"
      onClick={() => navigate(`/alunos/${athleteId}`)}
    >
      Abrir a ficha do aluno
    </button>
  )

  const days = (plans ?? []).flatMap(({ plan, days: list }) =>
    list.map((day) => ({ plan, day })),
  )

  /** Os treinos do aluno, um por linha: tocar num abre-o para registar. */
  const dayList = (list: typeof days) => (
    <ul className="agenda-sheet__days">
      {list.map(({ plan, day }) => (
        <li key={day.id}>
          <button
            type="button"
            className="agenda-sheet__day"
            disabled={busy}
            onClick={() => register(plan, day.id)}
          >
            <span className="agenda-sheet__letter">{day.label}</span>
            <span className="agenda-row__text">
              <strong>{day.title ?? `Treino ${day.label}`}</strong>
              <em>{plan.name}</em>
            </span>
            <span className="agenda-row__go" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  if (item.kind === 'workout') {
    const { entry } = item
    const session = entry.session
    // O marcado é a sugestão; os outros treinos do aluno ficam à mão para o
    // dia em que se decide dar outra coisa.
    const otherDays = days.filter(({ day }) => day.id !== entry.schedule.plan_day_id)
    return (
      <Sheet
        title={athlete?.full_name ?? 'Aluno'}
        caption={`${workoutName(entry)} · ${when}`}
        done="Fechar"
        onClose={onClose}
      >
        {failure && <p className="error-banner">{failure}</p>}

        <button
          type="button"
          className="btn btn--accent btn--block"
          disabled={busy || !entry.plan || !entry.day || entry.exerciseCount === 0}
          onClick={() => entry.plan && entry.day && register(entry.plan, entry.day.id, entry)}
        >
          {session?.status === 'done'
            ? 'Ver ou corrigir o que ficou registado'
            : session
              ? 'Continuar o registo do treino'
              : 'Registar eu o treino'}
        </button>
        {!session && (
          <p className="agenda-sheet__hint muted">
            Para um treino presencial: abres o treino do aluno e és tu a escrever
            as cargas e as repetições.
          </p>
        )}

        {entry.plan && entry.day && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() =>
              navigate(
                `/treino/ver/${entry.plan!.id}/${entry.day!.id}?marcacao=${entry.schedule.id}`,
                { state: { from } },
              )
            }
          >
            Ver os exercícios
          </button>
        )}

        {!session && otherDays.length > 0 && (
          <div className="field">
            {others ? (
              <>
                <span className="field__label">Dar outro treino hoje</span>
                {dayList(otherDays)}
              </>
            ) : (
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => setOthers(true)}
              >
                Dar outro treino
              </button>
            )}
          </div>
        )}

        {ficha}

        {!session && entry.schedule.coach_id === coachId && (
          <button
            type="button"
            className="btn btn--sm btn--quiet btn--danger agenda-sheet__remove"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await unscheduleWorkout(entry.schedule.id)
                onChanged()
                onClose()
              })
            }
          >
            Desmarcar este treino
          </button>
        )}
      </Sheet>
    )
  }

  const { presence } = item
  const answer = presence.attendance

  return (
    <Sheet
      title={athlete?.full_name ?? 'Aluno'}
      caption={`Treino presencial · ${when}`}
      done="Fechar"
      onClose={onClose}
    >
      {failure && <p className="error-banner">{failure}</p>}

      <div className={`agenda-sheet__status is-${presence.status}`}>
        {presence.status === 'going' && (
          <p>
            {answer
              ? 'O aluno confirmou que vai.'
              : 'O aluno ainda não disse nada — conta-se com ele.'}
          </p>
        )}
        {presence.status === 'moved' && (
          <p>Mudado de {longDate(presence.originalDate).toLowerCase()}, a pedido do aluno.</p>
        )}
        {presence.status === 'not_going' && (
          <p>
            O aluno disse que não vai.
            {answer?.proposed_date && answer.proposal_accepted === false
              ? ' Propôs outra data e tu recusaste.'
              : ''}
          </p>
        )}
        {presence.status === 'proposed' && answer?.proposed_date && (
          <>
            <p>
              Não pode ir e propõe{' '}
              <strong>
                {longDate(answer.proposed_date).toLowerCase()}
                {answer.proposed_time ? ` às ${answer.proposed_time.slice(0, 5)}` : ''}
              </strong>
              .
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn--quiet"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await answerProposal(answer.id, false)
                    onChanged()
                    onClose()
                  })
                }
              >
                Recusar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await answerProposal(answer.id, true)
                    onChanged()
                    onClose()
                  })
                }
              >
                Aceitar a data
              </button>
            </div>
          </>
        )}
        {answer?.note && <p className="agenda-sheet__note">“{answer.note}”</p>}
      </div>

      {presence.status !== 'not_going' && (
        <div className="field">
          <span className="field__label">Registar eu o treino</span>
          {loading ? (
            <p className="muted agenda-sheet__hint">A carregar os treinos do aluno…</p>
          ) : days.length === 0 ? (
            <p className="muted agenda-sheet__hint">
              Este aluno ainda não tem nenhum plano publicado com exercícios.
            </p>
          ) : (
            dayList(days)
          )}
        </div>
      )}

      {ficha}
    </Sheet>
  )
}
