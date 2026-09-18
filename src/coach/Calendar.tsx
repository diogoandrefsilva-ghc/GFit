import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { WeekNav } from '@/components/WeekNav'
import { fetchAthletes, fetchCoachCalendar } from '@/lib/api'
import { dayOfMonth, isoDate, plural, weekDates, weekStart, weekdayShort } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './calendar.css'

/**
 * A semana dos alunos todos num ecrã: quem treina em que dia, e o que já foi
 * feito. É a vista de quem marcou os treinos e quer saber se estão a acontecer.
 */
export function CoachCalendar() {
  const coach = useProfile()
  const today = isoDate()
  const [monday, setMonday] = useState(() => weekStart(today))
  const [athleteId, setAthleteId] = useState<string | null>(null)

  const { data, loading, error } = useQuery(['calendario-treinador', coach.id, monday], async () => {
    const dates = weekDates(monday)
    const [calendar, athletes] = await Promise.all([
      fetchCoachCalendar(coach.id, dates[0], dates[6]),
      fetchAthletes(coach.id),
    ])
    return { calendar, athletes }
  })

  if (loading) return <Loading label="A carregar o calendário" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { calendar, athletes } = data!
  const visible = athleteId
    ? calendar.filter((entry) => entry.schedule.athlete_id === athleteId)
    : calendar
  const done = visible.filter((entry) => entry.session?.status === 'done').length
  const dates = weekDates(monday)

  return (
    <div className="screen">
      <ScreenHeader
        title="Calendário"
        subtitle={
          visible.length === 0
            ? 'Sem treinos marcados nesta semana'
            : `${done} de ${plural(visible.length, 'treino marcado', 'treinos marcados')} feitos`
        }
      />

      <WeekNav monday={monday} onChange={setMonday} />

      {athletes.length > 1 && (
        <div className="row row--wrap cal__filter">
          <button
            type="button"
            className={`chip ${athleteId === null ? 'chip--on' : ''}`}
            onClick={() => setAthleteId(null)}
          >
            Todos
          </button>
          {athletes.map((athlete) => (
            <button
              key={athlete.id}
              type="button"
              className={`chip ${athleteId === athlete.id ? 'chip--on' : ''}`}
              onClick={() => setAthleteId(athlete.id)}
            >
              {athlete.full_name ?? athlete.email ?? 'Aluno'}
            </button>
          ))}
        </div>
      )}

      {calendar.length === 0 && (
        <Empty
          title="Nada marcado nesta semana"
          hint="Os treinos marcam-se no calendário do plano, depois de o plano estar publicado."
        />
      )}

      <ul className="cal-days">
        {dates.map((date) => {
          const entries = visible.filter(
            (entry) => entry.schedule.scheduled_on === date,
          )

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
                {entries.length === 0 ? (
                  <span className="cal-day__rest">sem treinos</span>
                ) : (
                  entries.map((entry) => {
                    const state =
                      entry.session?.status === 'done'
                        ? 'feito'
                        : entry.session?.status === 'in_progress'
                          ? 'a meio'
                          : date < today
                            ? 'em falta'
                            : null

                    return (
                      <Link
                        key={entry.schedule.id}
                        to={`/alunos/${entry.schedule.athlete_id}`}
                        className="cal-day__card"
                      >
                        <Avatar
                          name={entry.athlete?.full_name}
                          url={entry.athlete?.avatar_url}
                          size={28}
                        />
                        <span className="cal-day__text">
                          <strong>{entry.athlete?.full_name ?? 'Aluno'}</strong>
                          <em>
                            {entry.day?.label ?? '?'}
                            {entry.day?.title ? ` · ${entry.day.title}` : ''} ·{' '}
                            {plural(entry.exerciseCount, 'exercício', 'exercícios')}
                          </em>
                        </span>
                        {state && (
                          <span
                            className={`chip ${
                              state === 'feito'
                                ? 'chip--good'
                                : state === 'a meio'
                                  ? 'chip--accent'
                                  : ''
                            }`}
                          >
                            {state}
                          </span>
                        )}
                      </Link>
                    )
                  })
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
