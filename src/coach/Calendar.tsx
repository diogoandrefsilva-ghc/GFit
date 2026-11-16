import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { AgendaRow, AgendaSheet } from '@/coach/Agenda'
import { ScheduleSheet } from '@/coach/ScheduleSheet'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { WeekNav } from '@/components/WeekNav'
import {
  fetchAthletes,
  fetchAttendance,
  fetchCoachCalendar,
  fetchTrainingSlots,
  soft,
} from '@/lib/api'
import { buildAgenda, presences, type AgendaItem } from '@/lib/agenda'
import { dayOfMonth, isoDate, plural, weekDates, weekStart, weekdayShort } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './calendar.css'

/**
 * A semana dos alunos todos num ecrã: quem treina em que dia, e o que já foi
 * feito. É a vista de quem marcou os treinos e quer saber se estão a acontecer.
 *
 * Mostra também o que não foi ele a marcar: os auto-treinos dos alunos, com a
 * marca "auto" para não se confundirem com o que prescreveu, e os treinos dele
 * próprio. E o que ninguém marcou à mão: os treinos presenciais, que saem do
 * dia e da hora postos na ficha de cada aluno.
 *
 * Tocar num treino abre o que se pode fazer com ele — a começar por ser o
 * treinador a registá-lo, que é o que acontece num treino presencial.
 */
export function CoachCalendar() {
  const coach = useProfile()
  const today = isoDate()
  const [monday, setMonday] = useState(() => weekStart(today))
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const navigate = useNavigate()
  const [open, setOpen] = useState<AgendaItem | null>(null)
  /** O dia para que se está a marcar um treino, com o painel aberto. */
  const [scheduling, setScheduling] = useState<string | null>(null)

  const { data, loading, error, reload } = useQuery(
    ['calendario-treinador', coach.id, monday],
    async () => {
      const dates = weekDates(monday)
      const [calendar, athletes, slots, attendance] = await Promise.all([
        fetchCoachCalendar(dates[0], dates[6]),
        fetchAthletes(coach.id),
        soft(fetchTrainingSlots(), []),
        soft(fetchAttendance(dates[0], dates[6]), []),
      ])
      return { calendar, athletes, slots, attendance }
    },
  )

  if (loading) return <Loading label="A carregar o calendário" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { calendar, athletes } = data!
  const dates = weekDates(monday)
  const agenda = buildAgenda(
    calendar,
    // O `?? []` é para a cache de uma versão anterior, que ainda não os trazia.
    presences(data!.slots ?? [], data!.attendance ?? [], dates[0], dates[6]),
    athletes,
  )
  const ownerOf = (item: AgendaItem) =>
    item.kind === 'workout' ? item.entry.schedule.athlete_id : item.presence.slot.athlete_id
  const visible = athleteId ? agenda.filter((item) => ownerOf(item) === athleteId) : agenda
  // O treinador só aparece no filtro se tiver treinos marcados para si.
  const filters = calendar.some((entry) => entry.schedule.athlete_id === coach.id)
    ? [{ id: coach.id, name: 'Eu' }, ...athletes.map((item) => ({
        id: item.id,
        name: item.full_name ?? item.email ?? 'Aluno',
      }))]
    : athletes.map((item) => ({
        id: item.id,
        name: item.full_name ?? item.email ?? 'Aluno',
      }))
  const workouts = visible.filter((item) => item.kind === 'workout')
  const done = workouts.filter(
    (item) => item.kind === 'workout' && item.entry.session?.status === 'done',
  ).length
  const inPerson = visible.length - workouts.length

  return (
    <div className="screen">
      <ScreenHeader
        title="Calendário"
        subtitle={
          visible.length === 0
            ? 'Sem treinos marcados nesta semana'
            : [
                workouts.length > 0
                  ? `${done} de ${plural(workouts.length, 'treino marcado', 'treinos marcados')} feitos`
                  : null,
                inPerson > 0 ? plural(inPerson, 'presencial', 'presenciais') : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        action={
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setScheduling(dates.includes(today) ? today : dates[0])}
          >
            + Marcar
          </button>
        }
      />

      <WeekNav monday={monday} onChange={setMonday} />

      {filters.length > 1 && (
        <div className="row row--wrap cal__filter">
          <button
            type="button"
            className={`chip ${athleteId === null ? 'chip--on' : ''}`}
            onClick={() => setAthleteId(null)}
          >
            Todos
          </button>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${athleteId === item.id ? 'chip--on' : ''}`}
              onClick={() => setAthleteId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {agenda.length === 0 && (
        <Empty
          title="Nada marcado nesta semana"
          hint="Marca um treino com o + Marcar, ou toca num dia. O treino presencial de cada aluno (ex.: sextas às 12:30) define-se na ficha dele e aparece aqui sozinho."
        />
      )}

      <ul className="cal-days">
        {dates.map((date) => {
          const entries = visible.filter((item) => item.date === date)

          return (
            <li
              key={date}
              className={`cal-day ${date === today ? 'is-today' : ''} ${
                entries.length === 0 ? 'is-empty' : ''
              }`}
            >
              <span className="cal-day__date">
                <em>{weekdayShort(date)}</em>
                <strong>{dayOfMonth(date)}</strong>
              </span>

              <div className="cal-day__body">
                {entries.map((item) => (
                  <AgendaRow
                    key={item.key}
                    item={item}
                    coachId={coach.id}
                    onOpen={() =>
                      ownerOf(item) === coach.id ? navigate('/eu?zona=treino') : setOpen(item)
                    }
                  />
                ))}
                {/* Um dia vazio é um convite a marcar: o toque abre o painel já nesse dia. */}
                {entries.length === 0 && (
                  <button
                    type="button"
                    className="cal-day__add"
                    onClick={() => setScheduling(date)}
                  >
                    sem treinos · marcar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {scheduling && (
        <ScheduleSheet
          key={scheduling}
          coachId={coach.id}
          athletes={athletes}
          athleteId={athleteId && athleteId !== coach.id ? athleteId : null}
          date={scheduling}
          onClose={() => setScheduling(null)}
          onDone={reload}
        />
      )}
      {open && (
        <AgendaSheet
          item={open}
          coachId={coach.id}
          from="/calendario"
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}
