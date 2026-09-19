import { useEffect, useMemo, useState } from 'react'
import { Loading, ScreenHeader } from '@/components/Screen'
import { MuscleFilter } from '@/components/MuscleFilter'
import { MuscleThumb } from '@/components/MuscleThumb'
import { VideoModal } from '@/components/VideoModal'
import { hasPlayableVideo } from '@/lib/video'
import type { Exercise, MuscleShare } from '@/lib/database.types'
import {
  createExercise,
  deleteExercise,
  fetchMuscles,
  searchExercises,
  updateExercise,
  type ExerciseInput,
} from '@/lib/api'
import { describeError, supabase } from '@/lib/supabase'
import { num, plural, titleCase } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import '@/coach/exercise-picker.css'
import './exercise-library.css'

const PATTERNS = ['Puxar', 'Empurrar', 'Perna', 'Core', 'Geral']

type MuscleOption = { slug: string; name: string }

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

  const { data: counts, reload: reloadCounts } = useQuery(
    ['exercicios-contagem'],
    async () => {
      const total = await supabase
        .from('exercises')
        .select('id', { count: 'exact', head: true })
      const withVideo = await supabase
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .not('video_url', 'is', null)
      return { total: total.count ?? 0, withVideo: withVideo.count ?? 0 }
    },
  )

  const muscleNames = useMemo(
    () => new Map((muscles ?? []).map((item) => [item.slug, item.name])),
    [muscles],
  )

  const refreshAfterChange = () => {
    reload()
    reloadCounts()
  }

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
        <ExerciseForm
          title="Novo exercício"
          muscles={muscles ?? []}
          onSaved={() => {
            setCreating(false)
            refreshAfterChange()
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
                muscles={muscles ?? []}
                muscleNames={muscleNames}
                onVideo={() => setVideo(exercise)}
                onChanged={refreshAfterChange}
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

type ExerciseFormValues = {
  name: string
  primary: string
  pattern: string
  category: string
  equipment: string
  video: string
  secondary: Record<string, number>
}

function blankForm(): ExerciseFormValues {
  return {
    name: '',
    primary: '',
    pattern: '',
    category: '',
    equipment: '',
    video: '',
    secondary: {},
  }
}

function formFromExercise(exercise: Exercise): ExerciseFormValues {
  const secondary: Record<string, number> = {}
  for (const share of exercise.muscles ?? []) {
    if (share.muscle && share.muscle !== exercise.primary_muscle) {
      secondary[share.muscle] = Number(share.weight)
    }
  }
  return {
    name: exercise.name,
    primary: exercise.primary_muscle ?? '',
    pattern: exercise.pattern ?? '',
    category: exercise.category ?? '',
    equipment: exercise.equipment ?? '',
    video: exercise.video_url ?? '',
    secondary,
  }
}

/** O músculo principal conta série inteira, como na planilha; os secundários entram com o peso escolhido. */
function buildMuscles(values: ExerciseFormValues): MuscleShare[] {
  const shares: MuscleShare[] = []
  if (values.primary) shares.push({ muscle: values.primary, weight: 1 })
  for (const [muscle, weight] of Object.entries(values.secondary)) {
    if (muscle !== values.primary) shares.push({ muscle, weight })
  }
  return shares
}

function buildPayload(values: ExerciseFormValues): ExerciseInput {
  return {
    name: values.name.trim(),
    pattern: values.pattern || null,
    category: values.category.trim() || null,
    primary_muscle: values.primary || null,
    equipment: values.equipment.trim() || null,
    video_url: values.video.trim() || null,
    muscles: buildMuscles(values),
  }
}

/**
 * Formulário de criar/editar exercício. Sem `initial`, cria um novo; com
 * `initial`, atualiza esse exercício no lugar.
 */
function ExerciseForm({
  title,
  muscles,
  initial,
  onSaved,
  onCancel,
}: {
  title: string
  muscles: MuscleOption[]
  initial?: Exercise
  onSaved: () => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState<ExerciseFormValues>(
    initial ? formFromExercise(initial) : blankForm(),
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = (patch: Partial<ExerciseFormValues>) =>
    setValues((current) => ({ ...current, ...patch }))

  const cycleSecondary = (slug: string) => {
    setValues((current) => {
      const secondary = { ...current.secondary }
      const weight = secondary[slug]
      if (weight === undefined) secondary[slug] = 0.5
      else if (weight === 0.5) secondary[slug] = 0.3
      else delete secondary[slug]
      return { ...current, secondary }
    })
  }

  const secondaryOptions = muscles.filter((item) => item.slug !== values.primary)

  return (
    <section className="card">
      <span className="eyebrow">{title}</span>

      <label className="field">
        <span className="field__label">Nome</span>
        <input
          className="input"
          value={values.name}
          onChange={(event) => set({ name: event.target.value })}
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Músculo principal</span>
          <select
            className="select"
            value={values.primary}
            onChange={(event) => {
              const primary = event.target.value
              setValues((current) => {
                const secondary = { ...current.secondary }
                delete secondary[primary]
                return { ...current, primary, secondary }
              })
            }}
          >
            <option value="">—</option>
            {muscles.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Padrão</span>
          <select
            className="select"
            value={values.pattern}
            onChange={(event) => set({ pattern: event.target.value })}
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
        <span className="field__label">Músculos secundários</span>
        <div className="row row--wrap">
          {secondaryOptions.map((item) => {
            const weight = values.secondary[item.slug]
            return (
              <button
                key={item.slug}
                type="button"
                className={`chip ${weight ? 'chip--on' : ''}`}
                onClick={() => cycleSecondary(item.slug)}
              >
                {item.name}
                {weight ? ` · ${formatWeight(weight)}` : ''}
              </button>
            )
          })}
        </div>
        <span className="field__hint">
          toca para acrescentar; toca outra vez para baixar o peso (0,5 → 0,3); mais uma para tirar
        </span>
      </label>

      <label className="field">
        <span className="field__label">Categoria</span>
        <input
          className="input"
          value={values.category}
          placeholder="Bicep curl, Elevações/puxadas vertical…"
          onChange={(event) => set({ category: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Equipamento</span>
        <input
          className="input"
          value={values.equipment}
          placeholder="Halteres, Barra, Cabos…"
          onChange={(event) => set({ equipment: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Vídeo (link)</span>
        <input
          className="input"
          type="url"
          value={values.video}
          placeholder="https://youtu.be/…"
          onChange={(event) => set({ video: event.target.value })}
        />
      </label>

      {failure && <p className="error-banner">{failure}</p>}

      <div className="row">
        {onCancel && (
          <button
            type="button"
            className="btn btn--quiet"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          className={`btn btn--primary ${onCancel ? '' : 'btn--block'}`}
          disabled={busy || values.name.trim().length === 0}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              const payload = buildPayload(values)
              if (initial) await updateExercise(initial.id, payload)
              else await createExercise(payload)
              onSaved()
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : initial ? 'Guardar' : 'Adicionar à base'}
        </button>
      </div>
    </section>
  )
}

/**
 * Uma linha da lista. O corpo não vem desenhado de origem: a 44 px não se
 * distinguiria peito de ombro, e 120 deles punham a lista a demorar mais de um
 * segundo a aparecer a cada tecla da pesquisa. Abre-se o que se quer ver.
 */
/** 1 em vez de 1,0; 0,5 e 0,3 mantêm a casa decimal. */
function formatWeight(weight: number): string {
  return num(weight, weight % 1 === 0 ? 0 : 1)
}

/**
 * Uma linha da lista: o corpo à esquerda, o exercício no meio com o vídeo por
 * baixo, e à direita o que ele trabalha com os pesos da planilha. A editar,
 * a linha dá lugar ao mesmo formulário usado para criar.
 */
function LibraryRow({
  exercise,
  muscles,
  muscleNames,
  onVideo,
  onChanged,
}: {
  exercise: Exercise
  muscles: MuscleOption[]
  muscleNames: Map<string, string>
  onVideo: () => void
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (editing) {
    return (
      <li className="library__item library__item--editing">
        <ExerciseForm
          title="Editar exercício"
          muscles={muscles}
          initial={exercise}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  const shares = Array.isArray(exercise.muscles) ? exercise.muscles : []
  const meta = [exercise.pattern, exercise.equipment].filter(Boolean).join(' · ')

  return (
    <li className="library__item">
      <MuscleThumb muscles={shares} names={muscleNames} />

      <div className="library__main">
        <strong className="library__name">{titleCase(exercise.name)}</strong>
        {meta && <em className="library__meta">{titleCase(meta)}</em>}

        <div className="library__actions">
          {hasPlayableVideo(exercise.video_url) ? (
            <button type="button" className="library__video" onClick={onVideo}>
              ▸ vídeo
            </button>
          ) : (
            <span className="library__novideo">sem vídeo</span>
          )}
          <button
            type="button"
            className="library__edit"
            onClick={() => setEditing(true)}
          >
            editar
          </button>
          <button
            type="button"
            className="library__delete"
            disabled={deleting}
            onClick={async () => {
              if (!window.confirm(`Apagar "${exercise.name}" da base de exercícios?`)) return
              setDeleting(true)
              setFailure(null)
              try {
                await deleteExercise(exercise.id)
                onChanged()
              } catch (caught) {
                setFailure(describeError(caught))
                setDeleting(false)
              }
            }}
          >
            {deleting ? 'a apagar…' : 'apagar'}
          </button>
        </div>
        {failure && <p className="error-banner">{failure}</p>}
      </div>

      <div className="library__work">
        {shares.length > 0 ? (
          <ul>
            {[...shares]
              .sort((a, b) => Number(b.weight) - Number(a.weight))
              .map((share) => (
                <li key={share.muscle}>
                  <span>{titleCase(muscleNames.get(share.muscle) ?? share.muscle)}</span>
                  <em>{formatWeight(Number(share.weight))}</em>
                </li>
              ))}
          </ul>
        ) : (
          <p className="library__nomuscle">sem músculos na base</p>
        )}
      </div>
    </li>
  )
}
