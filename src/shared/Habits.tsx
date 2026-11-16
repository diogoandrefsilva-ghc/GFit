import { useEffect, useState } from 'react'
import {
  addHabit,
  archiveHabit,
  fetchHabitLogs,
  fetchHabits,
  setHabitDone,
} from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { addDays, isoDate, plural, weekdayShort } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { Habit, HabitLog } from '@/lib/database.types'
import './habits.css'

/** Os últimos sete dias, do mais antigo a hoje. */
function lastWeek(today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
}

/**
 * Os hábitos do dia, no Hoje. Um toque marca, outro desmarca — não há painel
 * nem número: um hábito ou se fez ou não se fez. O que se vê muda no toque e
 * só depois é gravado; se a gravação falhar, relê-se para o ecrã não mentir.
 */
export function HabitsToday({
  habits,
  logs,
  today,
  onChanged,
}: {
  habits: Habit[]
  /** Os registos dos últimos sete dias, hoje incluído. */
  logs: HabitLog[]
  today: string
  onChanged: () => void
}) {
  const fromServer = logs
    .filter((log) => log.log_date === today)
    .map((log) => log.habit_id)
    .sort()
    .join('|')
  const [done, setDone] = useState(() => new Set(fromServer ? fromServer.split('|') : []))
  const [failure, setFailure] = useState<string | null>(null)

  // O servidor manda: quando a leitura traz outra coisa, é ela que vale.
  useEffect(() => {
    setDone(new Set(fromServer ? fromServer.split('|') : []))
  }, [fromServer])

  if (habits.length === 0) return null

  async function toggle(habit: Habit) {
    const next = !done.has(habit.id)
    setDone((current) => {
      const copy = new Set(current)
      if (next) copy.add(habit.id)
      else copy.delete(habit.id)
      return copy
    })
    setFailure(null)
    try {
      await setHabitDone(habit, today, next)
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      onChanged()
    }
  }

  const count = habits.filter((habit) => done.has(habit.id)).length

  return (
    <section className="reg-block habits">
      <div className="card__head">
        <h2 className="reg-block__title">Hábitos de hoje</h2>
        <span className={`habits__count ${count === habits.length ? 'is-all' : ''}`}>
          {count} de {habits.length}
        </span>
      </div>

      <ul className="habits__list">
        {habits.map((habit) => {
          const checked = done.has(habit.id)
          const week = logs.filter(
            (log) => log.habit_id === habit.id && log.log_date !== today,
          ).length + (checked ? 1 : 0)
          return (
            <li key={habit.id}>
              <button
                type="button"
                className={`habit ${checked ? 'is-done' : ''}`}
                aria-pressed={checked}
                onClick={() => toggle(habit)}
              >
                {habit.emoji && (
                  <span className="habit__emoji" aria-hidden>
                    {habit.emoji}
                  </span>
                )}
                <span className="habit__text">
                  <strong>{habit.name}</strong>
                  <em>{plural(week, 'dia', 'dias')} nos últimos 7</em>
                </span>
                <span className="habit__check" aria-hidden>
                  {checked ? '✓' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {failure && <p className="error-banner">{failure}</p>}
    </section>
  )
}

const EMOJI = ['💧', '💊', '🧘', '🥦', '🚶', '😴', '📵', '☀️'] as const

const PRESETS: { name: string; emoji: string }[] = [
  { name: 'Beber 2 L de água', emoji: '💧' },
  { name: 'Tomar a creatina', emoji: '💊' },
  { name: '10 min de alongamentos', emoji: '🧘' },
  { name: 'Legumes ao almoço e ao jantar', emoji: '🥦' },
]

/**
 * Os hábitos de alguém, vistos por quem os define: o treinador na ficha do
 * aluno, ou o próprio quando não tem treinador. Mostra a semana de cada um —
 * que é o que o treinador quer saber — e deixa acrescentar e retirar.
 */
export function HabitsEditor({
  athleteId,
  authorId,
  habits,
  logs,
  today,
  self = false,
  onChanged,
}: {
  athleteId: string
  authorId: string
  habits: Habit[]
  /** Os registos dos últimos sete dias. */
  logs: HabitLog[]
  today: string
  /** Os hábitos são de quem os está a definir. */
  self?: boolean
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const days = lastWeek(today)
  const unused = PRESETS.filter(
    (preset) => !habits.some((habit) => habit.name === preset.name),
  )

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    const clean = name.trim()
    if (!clean) return
    await run(async () => {
      await addHabit(athleteId, authorId, {
        name: clean,
        emoji,
        sort_order: habits.length,
      })
      setName('')
      setEmoji(null)
      setAdding(false)
    })
  }

  return (
    <section className="card">
      <div className="card__head">
        <span className="eyebrow">Hábitos</span>
        {!adding && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => setAdding(true)}
          >
            + Hábito
          </button>
        )}
      </div>
      <p className="subtitle">
        {self
          ? 'O que queres marcar todos os dias, além do registo do costume. Aparecem no teu "Hoje".'
          : 'O que queres que o aluno marque todos os dias. Aparecem no "Hoje" dele, a um toque.'}
      </p>

      {habits.length > 0 && (
        <ul className="habits-edit">
          {habits.map((habit) => (
            <li key={habit.id} className="habits-edit__row">
              <span className="habits-edit__name">
                {habit.emoji && <span aria-hidden>{habit.emoji} </span>}
                <strong>{habit.name}</strong>
              </span>
              <span
                className="habits-edit__week"
                role="img"
                aria-label={`${
                  logs.filter((log) => log.habit_id === habit.id).length
                } dos últimos 7 dias`}
              >
                {days.map((date) => {
                  const hit = logs.some(
                    (log) => log.habit_id === habit.id && log.log_date === date,
                  )
                  return (
                    <i key={date} className={hit ? 'is-done' : ''}>
                      {weekdayShort(date).charAt(0).toUpperCase()}
                    </i>
                  )
                })}
              </span>
              <button
                type="button"
                className="habits-edit__remove"
                disabled={busy}
                aria-label={`Deixar de acompanhar ${habit.name}`}
                onClick={() => {
                  if (!window.confirm(`Deixar de acompanhar "${habit.name}"?`)) return
                  run(() => archiveHabit(habit.id))
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="habits-edit__form">
          {unused.length > 0 && (
            <div className="row row--wrap">
              {unused.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setName(preset.name)
                    setEmoji(preset.emoji)
                  }}
                >
                  {preset.emoji} {preset.name}
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span className="field__label">O hábito</span>
            <input
              className="input"
              value={name}
              maxLength={60}
              placeholder="Beber 2 L de água"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <div className="habits-edit__emoji" role="group" aria-label="Símbolo">
            {EMOJI.map((option) => (
              <button
                key={option}
                type="button"
                className={`habits-edit__pick ${emoji === option ? 'is-on' : ''}`}
                aria-pressed={emoji === option}
                onClick={() => setEmoji(emoji === option ? null : option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="row">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                setAdding(false)
                setName('')
                setEmoji(null)
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || name.trim().length === 0}
              onClick={add}
            >
              {busy ? 'A guardar…' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {failure && <p className="error-banner">{failure}</p>}
    </section>
  )
}

/**
 * Os hábitos de alguém com a sua própria leitura, para caber na ficha sem
 * pesar na consulta dela: a ficha já traz dez coisas, e os hábitos mudam a
 * outro ritmo.
 */
export function HabitsPanel({
  athleteId,
  authorId,
  self = false,
}: {
  athleteId: string
  authorId: string
  self?: boolean
}) {
  const today = isoDate()
  const { data, error, reload } = useQuery(['habitos', athleteId, today], async () => {
    const [habits, logs] = await Promise.all([
      fetchHabits(athleteId),
      fetchHabitLogs(athleteId, addDays(today, -6), today),
    ])
    return { habits, logs }
  })

  if (error) return <p className="error-banner">{error}</p>

  return (
    <HabitsEditor
      athleteId={athleteId}
      authorId={authorId}
      habits={data?.habits ?? []}
      logs={data?.logs ?? []}
      today={today}
      self={self}
      onChanged={reload}
    />
  )
}
