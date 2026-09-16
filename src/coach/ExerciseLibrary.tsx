import { useEffect, useMemo, useState } from 'react'
import { Loading, ScreenHeader } from '@/components/Screen'
import { fetchMuscles, searchExercises } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { plural } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import '@/coach/exercise-picker.css'
import './exercise-library.css'

const PATTERNS = ['Puxar', 'Empurrar', 'Perna', 'Core', 'Geral']

/** A base de exercícios do Treinador, para consultar e acrescentar. */
export function ExerciseLibrary() {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [pattern, setPattern] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 220)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data: muscles } = useQuery(fetchMuscles, [])
  const {
    data: results,
    loading,
    reload,
  } = useQuery(() => searchExercises(debounced, { muscle, pattern }), [
    debounced,
    muscle,
    pattern,
  ])

  const { data: counts } = useQuery(async () => {
    const total = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
    const withVideo = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .not('video_url', 'is', null)
    return { total: total.count ?? 0, withVideo: withVideo.count ?? 0 }
  }, [])

  const muscleNames = useMemo(
    () => new Map((muscles ?? []).map((item) => [item.slug, item.name])),
    [muscles],
  )

  return (
    <div className="screen">
      <ScreenHeader
        title="Exercícios"
        subtitle={
          counts
            ? `${counts.total} na base · ${counts.withVideo} com vídeo`
            : undefined
        }
        action={
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? 'Fechar' : '+ Novo'}
          </button>
        }
      />

      {creating && (
        <NewExerciseForm
          muscles={muscles ?? []}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}

      <input
        className="input"
        value={term}
        placeholder="Procurar (ex.: puxada, supino, gémeo)"
        onChange={(event) => setTerm(event.target.value)}
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

      {loading ? (
        <Loading label="A procurar" />
      ) : (
        <>
          <p className="library__count muted">
            {plural(results?.length ?? 0, 'resultado', 'resultados')}
            {(results?.length ?? 0) === 120 ? ' (primeiros 120)' : ''}
          </p>
          <ul className="library">
            {(results ?? []).map((exercise) => (
              <li key={exercise.id} className="library__item">
                <span className="library__text">
                  <strong>{exercise.name}</strong>
                  <em>
                    {[
                      exercise.pattern,
                      exercise.primary_muscle
                        ? muscleNames.get(exercise.primary_muscle)
                        : null,
                      exercise.equipment,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </em>
                </span>
                {exercise.video_url ? (
                  <a
                    className="library__video"
                    href={exercise.video_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ▸ vídeo
                  </a>
                ) : (
                  <span className="library__novideo">sem vídeo</span>
                )}
              </li>
            ))}
            {(results?.length ?? 0) === 0 && (
              <li className="empty">Nada encontrado{term ? ` para "${term}"` : ''}.</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

function NewExerciseForm({
  muscles,
  onCreated,
}: {
  muscles: { slug: string; name: string }[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState('')
  const [pattern, setPattern] = useState('')
  const [video, setVideo] = useState('')
  const [equipment, setEquipment] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <section className="card">
      <span className="eyebrow">Novo exercício</span>

      <label className="field">
        <span className="field__label">Nome</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Músculo principal</span>
          <select
            className="select"
            value={primary}
            onChange={(event) => setPrimary(event.target.value)}
          >
            <option value="">—</option>
            {muscles.map((muscle) => (
              <option key={muscle.slug} value={muscle.slug}>
                {muscle.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Padrão</span>
          <select
            className="select"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          >
            <option value="">—</option>
            {PATTERNS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Equipamento</span>
        <input
          className="input"
          value={equipment}
          placeholder="Halteres, Barra, Cabos…"
          onChange={(event) => setEquipment(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Vídeo (link)</span>
        <input
          className="input"
          type="url"
          value={video}
          placeholder="https://youtu.be/…"
          onChange={(event) => setVideo(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || name.trim().length === 0}
        onClick={async () => {
          setBusy(true)
          try {
            unwrap(
              await supabase
                .from('exercises')
                .insert({
                  name: name.trim(),
                  pattern: pattern || null,
                  primary_muscle: primary || null,
                  equipment: equipment.trim() || null,
                  video_url: video.trim() || null,
                  // O músculo principal conta série inteira, como na planilha.
                  muscles: primary ? [{ muscle: primary, weight: 1 }] : [],
                })
                .select(),
            )
            onCreated()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A guardar…' : 'Adicionar à base'}
      </button>
    </section>
  )
}
