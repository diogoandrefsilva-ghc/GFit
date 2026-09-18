import { useEffect, useMemo, useState } from 'react'
import { Loading, ScreenHeader } from '@/components/Screen'
import { MuscleFilter } from '@/components/MuscleFilter'
import { MuscleThumb } from '@/components/MuscleThumb'
import { VideoModal } from '@/components/VideoModal'
import { hasPlayableVideo } from '@/lib/video'
import type { Exercise } from '@/lib/database.types'
import { fetchMuscles, searchExercises } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { num, plural } from '@/lib/format'
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
  const [video, setVideo] = useState<Exercise | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 220)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data: muscles } = useQuery(['musculos'], fetchMuscles)
  const {
    data: results,
    loading,
    reload,
  } = useQuery(
    ['exercicios', debounced, muscle, pattern],
    () => searchExercises(debounced, { muscle, pattern }),
    { persist: false },
  )

  const { data: counts } = useQuery(['exercicios-contagem'], async () => {
    const total = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
    const withVideo = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .not('video_url', 'is', null)
    return { total: total.count ?? 0, withVideo: withVideo.count ?? 0 }
  })

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
      </div>

      <MuscleFilter
        muscles={muscles ?? []}
        value={muscle}
        onChange={setMuscle}
        defaultOpen
      />

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
              <LibraryRow
                key={exercise.id}
                exercise={exercise}
                muscleNames={muscleNames}
                onVideo={() => setVideo(exercise)}
              />
            ))}
            {(results?.length ?? 0) === 0 && (
              <li className="empty">Nada encontrado{term ? ` para "${term}"` : ''}.</li>
            )}
          </ul>
        </>
      )}

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

/**
 * Uma linha da lista. O corpo não vem desenhado de origem: a 44 px não se
 * distinguiria peito de ombro, e 120 deles punham a lista a demorar mais de um
 * segundo a aparecer a cada tecla da pesquisa. Abre-se o que se quer ver.
 */
function LibraryRow({
  exercise,
  muscleNames,
  onVideo,
}: {
  exercise: Exercise
  muscleNames: Map<string, string>
  onVideo: () => void
}) {
  const [open, setOpen] = useState(false)
  const shares = Array.isArray(exercise.muscles) ? exercise.muscles : []

  return (
    <li className={`library__item ${open ? 'is-open' : ''}`}>
      <div className="library__row">
        <button
          type="button"
          className="library__text"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
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
        </button>
        {hasPlayableVideo(exercise.video_url) ? (
          <button type="button" className="library__video" onClick={onVideo}>
            ▸ vídeo
          </button>
        ) : (
          <span className="library__novideo">sem vídeo</span>
        )}
      </div>

      {open && (
        <div className="library__muscles">
          <MuscleThumb muscles={shares} names={muscleNames} />
          {shares.length > 0 ? (
            <ul className="library__shares">
              {[...shares]
                .sort((a, b) => Number(b.weight) - Number(a.weight))
                .map((share) => (
                  <li key={share.muscle}>
                    <span>{muscleNames.get(share.muscle) ?? share.muscle}</span>
                    <em>{num(Number(share.weight), 1)}</em>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">
              Este exercício não tem músculos atribuídos na base, por isso não
              acende nada nem conta para o volume.
            </p>
          )}
        </div>
      )}
    </li>
  )
}
