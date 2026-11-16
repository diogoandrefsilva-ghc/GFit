import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { fetchSessionDetail, fetchSessionLog, type SessionLogEntry } from '@/lib/api'
import { addDays, clock, isoDate, longDate, num, plural, titleCase } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './session-logs.css'

/** De quantos dias para trás se mostram treinos. */
const WINDOWS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [90, '3 meses'],
] as const

/**
 * Os treinos que os alunos registaram, do mais recente para trás. É a resposta
 * a "o que é que eles fizeram?": o treino, o dia, quanto demorou, e — ao toque
 * — as cargas e as repetições de cada série.
 */
export function SessionLogScreen() {
  const [days, setDays] = useState<number>(7)
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const since = addDays(isoDate(), -days)

  const { data, loading, error } = useQuery(['treinos-registados', since], () =>
    fetchSessionLog(since),
  )

  const entries = data ?? []
  const people = [
    ...new Map(
      entries
        .filter((entry) => entry.athlete)
        .map((entry) => [entry.athlete!.id, entry.athlete!]),
    ).values(),
  ]
  const visible = athleteId
    ? entries.filter((entry) => entry.session.athlete_id === athleteId)
    : entries
  const done = visible.filter((entry) => entry.session.status === 'done').length

  return (
    <div className="screen">
      <ScreenHeader
        back
        title="Treinos registados"
        subtitle={
          loading
            ? undefined
            : `${plural(done, 'treino feito', 'treinos feitos')} nos últimos ${days} dias`
        }
      />

      <div className="row row--wrap">
        {WINDOWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${days === value ? 'chip--on' : ''}`}
            onClick={() => setDays(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {people.length > 1 && (
        <div className="row row--wrap">
          <button
            type="button"
            className={`chip ${athleteId === null ? 'chip--on' : ''}`}
            onClick={() => setAthleteId(null)}
          >
            Todos
          </button>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`chip ${athleteId === person.id ? 'chip--on' : ''}`}
              onClick={() => setAthleteId(person.id)}
            >
              {(person.full_name ?? person.email ?? 'Aluno').split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loading label="A carregar os treinos" />
      ) : error ? (
        <p className="error-banner">{error}</p>
      ) : (
        <SessionLogList entries={visible} showAthlete from="/treinos" />
      )}
    </div>
  )
}

/** A lista, agrupada por dia. Serve este ecrã e o separador Treinos da ficha. */
export function SessionLogList({
  entries,
  showAthlete = false,
  from,
}: {
  entries: SessionLogEntry[]
  showAthlete?: boolean
  /** Para onde volta quem abre um treino daqui. */
  from: string
}) {
  if (entries.length === 0) {
    return (
      <Empty
        title="Sem treinos registados"
        hint="Quando um aluno registar um treino — ou o registares tu por ele —, aparece aqui."
      />
    )
  }

  const dates = [...new Set(entries.map((entry) => entry.session.session_date))]

  return (
    <ul className="log-days">
      {dates.map((date) => (
        <li key={date} className="log-day">
          <span className="log-day__label">
            {date === isoDate() ? 'Hoje' : longDate(date)}
          </span>
          <ul className="log-day__list">
            {entries
              .filter((entry) => entry.session.session_date === date)
              .map((entry) => (
                <SessionRow
                  key={entry.session.id}
                  entry={entry}
                  showAthlete={showAthlete}
                  from={from}
                />
              ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function SessionRow({
  entry,
  showAthlete,
  from,
}: {
  entry: SessionLogEntry
  showAthlete: boolean
  from: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { session, day, plan, athlete } = entry
  const workout = day
    ? `Treino ${day.label}${day.title ? ` · ${day.title}` : ''}`
    : 'Treino'
  const done = session.status === 'done'

  return (
    <li className={`log-row ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="log-row__head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {showAthlete && <Avatar name={athlete?.full_name} url={athlete?.avatar_url} size={34} />}
        <span className="log-row__text">
          <strong>{showAthlete ? (athlete?.full_name ?? 'Aluno') : workout}</strong>
          <em>
            {[
              showAthlete ? workout : plan?.name,
              session.duration_s ? clock(session.duration_s) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </em>
        </span>
        <span className={`chip ${done ? 'chip--good' : 'chip--accent'}`}>
          {done ? 'feito' : 'a meio'}
        </span>
      </button>

      {open && (
        <div className="log-row__body">
          <SessionSets sessionId={session.id} />
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => navigate(`/treino/${session.id}`, { state: { from } })}
          >
            Abrir o treino para corrigir
          </button>
        </div>
      )}
    </li>
  )
}

/** As séries de um treino. Só se pedem quando alguém o abre. */
function SessionSets({ sessionId }: { sessionId: string }) {
  const { data, loading, error } = useQuery(['treino-detalhe', sessionId], () =>
    fetchSessionDetail(sessionId),
  )

  if (loading) return <p className="muted log-row__note">A carregar as séries…</p>
  if (error) return <p className="error-banner">{error}</p>
  if (!data || data.length === 0) {
    return <p className="muted log-row__note">Não ficou nenhuma série registada.</p>
  }

  return (
    <ul className="log-sets">
      {data.map((exercise, index) => (
        <li key={index}>
          <strong>{titleCase(exercise.name)}</strong>
          <span>
            {exercise.sets
              .map((set) =>
                set.duration_s !== null && set.reps === null
                  ? `${set.duration_s}s`
                  : `${set.weight_kg !== null ? `${num(Number(set.weight_kg), 1).replace(/,0$/, '')} kg × ` : ''}${set.reps ?? '—'}${
                      set.rir !== null ? ` (RIR ${set.rir})` : ''
                    }`,
              )
              .join('  ·  ')}
          </span>
        </li>
      ))}
    </ul>
  )
}
