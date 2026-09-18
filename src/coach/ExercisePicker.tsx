import { useEffect, useMemo, useState } from 'react'
import { VideoModal } from '@/components/VideoModal'
import { fetchMuscles, searchExercises } from '@/lib/api'
import { hasPlayableVideo } from '@/lib/video'
import { useQuery } from '@/lib/useQuery'
import type { Exercise } from '@/lib/database.types'
import './exercise-picker.css'

const PATTERNS = ['Puxar', 'Empurrar', 'Perna', 'Core', 'Geral']

/**
 * Painel de escolha de exercícios da base do Treinador. Sobe por baixo do
 * ecrã para não perder o plano de vista.
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: Exercise) => Promise<void> | void
  onClose: () => void
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [pattern, setPattern] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [video, setVideo] = useState<Exercise | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 220)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data: muscles } = useQuery(['musculos'], fetchMuscles)
  const { data: results, loading } = useQuery(
    ['exercicios', debounced, muscle, pattern],
    () => searchExercises(debounced, { muscle, pattern }),
    { persist: false },
  )

  const muscleNames = useMemo(
    () => new Map((muscles ?? []).map((item) => [item.slug, item.name])),
    [muscles],
  )

  return (
    <div className="picker" role="dialog" aria-label="Base de exercícios">
      <button type="button" className="picker__scrim" onClick={onClose} aria-label="Fechar" />

      <div className="picker__sheet">
        <div className="picker__grip" />

        <div className="picker__head">
          <h2 className="picker__title">Base de exercícios</h2>
          <button type="button" className="btn btn--sm btn--quiet" onClick={onClose}>
            Fechar
          </button>
        </div>

        <input
          className="input"
          value={term}
          placeholder="Procurar (ex.: puxada, supino, gémeo)"
          onChange={(event) => setTerm(event.target.value)}
          autoFocus
        />

        <div className="picker__filters">
          {PATTERNS.map((item) => (
            <button
              key={item}
              type="button"
              className={`chip ${pattern === item ? 'chip--on' : ''}`}
              onClick={() => setPattern(pattern === item ? null : item)}
            >
              {item}
            </button>
          ))}
          {(muscles ?? []).map((item) => (
            <button
              key={item.slug}
              type="button"
              className={`chip ${muscle === item.slug ? 'chip--on' : ''}`}
              onClick={() => setMuscle(muscle === item.slug ? null : item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <ul className="picker__list">
          {loading && <li className="picker__empty">A procurar…</li>}
          {!loading && (results?.length ?? 0) === 0 && (
            <li className="picker__empty">
              Nada encontrado{term ? ` para "${term}"` : ''}.
            </li>
          )}
          {(results ?? []).map((exercise) => (
            <li key={exercise.id} className="picker__item">
              <button
                type="button"
                className={`picker__thumb ${
                  hasPlayableVideo(exercise.video_url) ? '' : 'is-empty'
                }`}
                onClick={() => hasPlayableVideo(exercise.video_url) && setVideo(exercise)}
                aria-label={`Ver vídeo de ${exercise.name}`}
                disabled={!hasPlayableVideo(exercise.video_url)}
              >
                {hasPlayableVideo(exercise.video_url) ? '▸' : 's/v'}
              </button>
              <span className="picker__text">
                <strong>{exercise.name}</strong>
                <em>
                  {[
                    exercise.primary_muscle
                      ? muscleNames.get(exercise.primary_muscle)
                      : null,
                    exercise.equipment,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </em>
              </span>
              <button
                type="button"
                className={`picker__add ${added.includes(exercise.id) ? 'is-on' : ''}`}
                onClick={async () => {
                  await onPick(exercise)
                  setAdded((current) => [...current, exercise.id])
                }}
                aria-label={`Adicionar ${exercise.name}`}
              >
                {added.includes(exercise.id) ? '✓' : '+'}
              </button>
            </li>
          ))}
        </ul>

        {added.length > 0 && (
          <button type="button" className="btn btn--accent btn--block" onClick={onClose}>
            {added.length === 1
              ? '1 exercício adicionado'
              : `${added.length} exercícios adicionados`}
          </button>
        )}
      </div>

      {video && (
        <VideoModal
          url={video.video_url}
          title={video.name}
          onClose={() => setVideo(null)}
        />
      )}
    </div>
  )
}
