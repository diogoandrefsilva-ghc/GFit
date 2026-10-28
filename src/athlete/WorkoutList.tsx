import { exerciseName, prescription } from '@/lib/workout'
import type { Exercise, PlanDay, PlanExercise } from '@/lib/database.types'
import './workout-list.css'

/**
 * A lista dos exercícios de um treino. É o que se vê antes de começar, e é o
 * resumo a que se volta a meio: cada linha diz o que se pede e, durante o
 * treino, quantas séries já lá estão.
 */
export function WorkoutList({
  day,
  exercises,
  library,
  done,
  current,
  onOpen,
}: {
  day: PlanDay
  exercises: PlanExercise[]
  library: Map<string, Exercise>
  /** Séries registadas por exercício do plano. Sem isto é só a lista. */
  done?: Map<string, number>
  /** O exercício que vem a seguir, para o marcar. */
  current?: number | null
  onOpen?: (index: number) => void
}) {
  return (
    <ol className="wlist">
      {exercises.map((item, index) => {
        const count = done?.get(item.id) ?? 0
        const complete = done !== undefined && count >= item.sets
        const body = (
          <>
            <span className="wlist__n">{complete ? '✓' : index + 1}</span>
            <span className="wlist__text">
              <strong>{exerciseName(item, library)}</strong>
              <em>{prescription(day, item)}</em>
              {!onOpen && item.notes && <span className="wlist__note">{item.notes}</span>}
            </span>
            {done !== undefined && (
              <span className={`wlist__count ${complete ? 'is-done' : ''}`}>
                {count}/{item.sets}
              </span>
            )}
          </>
        )
        const classes = `wlist__row ${complete ? 'is-done' : ''} ${
          current === index ? 'is-next' : ''
        }`

        return (
          <li key={item.id}>
            {onOpen ? (
              <button type="button" className={classes} onClick={() => onOpen(index)}>
                {body}
                <span className="wlist__go" aria-hidden>
                  →
                </span>
              </button>
            ) : (
              <div className={classes}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
