import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loading, ScreenHeader } from '@/components/Screen'
import { ExercisePicker } from '@/coach/ExercisePicker'
import {
  addExerciseToDay,
  fetchLimitations,
  fetchMuscles,
  fetchPlanDetail,
  publishPlan,
  removePlanExercise,
  updatePlanExercise,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { weeklyVolume } from '@/lib/calc'
import { num, plural, repRange } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import type { Exercise, PlanDay, PlanExercise, WorkMode } from '@/lib/database.types'
import './plan-editor.css'

export function PlanEditor() {
  const navigate = useNavigate()
  const { planId } = useParams<{ planId: string }>()
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const { data, loading, error, reload } = useQuery(async () => {
    const detail = await fetchPlanDetail(planId!)
    const [muscles, limitations] = await Promise.all([
      fetchMuscles(),
      fetchLimitations(detail.plan.athlete_id),
    ])
    // Só as que ainda vigoram: é o que condiciona o plano que se vai escrever.
    return { ...detail, muscles, limitations: limitations.filter((l) => !l.resolved_on) }
  }, [planId])

  const dayId = activeDay ?? data?.days[0]?.id ?? null

  const volume = useMemo(() => {
    if (!data || !dayId) return new Map<string, number>()
    return weeklyVolume(data.exercisesByDay.get(dayId) ?? [], data.library)
  }, [data, dayId])

  if (loading) return <Loading label="A carregar o plano" />
  if (error || !data) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <p className="error-banner">{error ?? 'Plano não encontrado.'}</p>
        </div>
      </div>
    )
  }

  const { plan, days, exercisesByDay, library, muscles, athlete, limitations } = data
  const day = days.find((item) => item.id === dayId) ?? null
  const items = day ? exercisesByDay.get(day.id) ?? [] : []
  const muscleNames = new Map(muscles.map((muscle) => [muscle.slug, muscle.name]))

  return (
    <div className="app">
      <div className="screen screen--plain">
        <ScreenHeader
          back={() => navigate(`/alunos/${plan.athlete_id}`)}
          eyebrow={athlete?.full_name ?? undefined}
          title={plan.name}
          subtitle={
            plan.status === 'published'
              ? `Publicado · ${plan.num_weeks} semanas`
              : 'Rascunho · o aluno ainda não vê'
          }
        />

        {limitations.length > 0 && (
          <section className="card card--accent">
            <span className="eyebrow">Limitações a respeitar</span>
            {limitations.map((limitation) => (
              <p key={limitation.id} className="plan__limitations">
                {limitation.body}
              </p>
            ))}
          </section>
        )}

        {/* ── selector de treino ─────────────────────── */}
        <div className="row row--wrap plan__days">
          {days.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${item.id === dayId ? 'chip--on' : ''}`}
              onClick={() => setActiveDay(item.id)}
            >
              {item.label}
              {item.title ? ` · ${item.title}` : ''}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={async () => {
              const next = String.fromCharCode(65 + days.length)
              const rows = unwrap(
                await supabase
                  .from('plan_days')
                  .insert({ plan_id: plan.id, label: next, sort_order: days.length })
                  .select(),
              )
              setActiveDay(rows[0].id)
              reload()
            }}
          >
            +
          </button>
        </div>

        {day && <DaySettings day={day} onChanged={reload} />}

        {/* ── exercícios ─────────────────────────────── */}
        <ul className="plan__exercises">
          {items.map((item, index) => (
            <PlanExerciseRow
              key={item.id}
              item={item}
              dayMode={day?.mode ?? 'reps'}
              exercise={item.exercise_id ? library.get(item.exercise_id) ?? null : null}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onChange={reload}
              onMove={async (direction) => {
                const other = items[index + direction]
                if (!other) return
                await Promise.all([
                  updatePlanExercise(item.id, { sort_order: other.sort_order }),
                  updatePlanExercise(other.id, { sort_order: item.sort_order }),
                ])
                reload()
              }}
            />
          ))}
        </ul>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          disabled={!day}
          onClick={() => setPicking(true)}
        >
          + Adicionar da base de exercícios
        </button>

        {/* ── volume ─────────────────────────────────── */}
        {volume.size > 0 && (
          <section className="card card--flat">
            <span className="eyebrow">
              Volume do treino {day?.label} · {plural(items.length, 'exercício', 'exercícios')}
            </span>
            <ul className="plan__volume">
              {[...volume.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([slug, sets]) => (
                  <li key={slug}>
                    <strong>{num(sets, sets % 1 === 0 ? 0 : 1)}</strong>
                    <span>{muscleNames.get(slug) ?? slug}</span>
                  </li>
                ))}
            </ul>
            <p className="plan__volume-note">
              Séries por músculo, com os auxiliares a contar 0,5 ou 0,3 como na
              planilha.
            </p>
          </section>
        )}

        <div className="row plan__actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => navigate(`/alunos/${plan.athlete_id}`)}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            disabled={plan.status === 'published'}
            onClick={async () => {
              await publishPlan(plan.id)
              reload()
            }}
          >
            {plan.status === 'published' ? 'Publicado ✓' : 'Publicar ao aluno'}
          </button>
        </div>
      </div>

      {picking && day && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (exercise) => {
            await addExerciseToDay(day.id, exercise, items.length)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PlanExerciseRow({
  item,
  dayMode,
  exercise,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
}: {
  item: PlanExercise
  dayMode: WorkMode
  exercise: Exercise | null
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: () => void
  onMove: (direction: 1 | -1) => void
}) {
  const [open, setOpen] = useState(false)
  const mode = item.mode ?? dayMode

  async function patch(values: Partial<PlanExercise>) {
    await updatePlanExercise(item.id, values)
    onChange()
  }

  return (
    <li className="plan-ex">
      <div className="plan-ex__head">
        <span className="plan-ex__text">
          <strong>{item.name_override ?? exercise?.name ?? 'Exercício'}</strong>
          <em>
            {[exercise?.category, exercise?.equipment].filter(Boolean).join(' · ') ||
              'sem categoria'}
            {exercise?.video_url ? ' · vídeo' : ''}
          </em>
        </span>
        <button
          type="button"
          className="plan-ex__toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          ⋯
        </button>
      </div>

      <div className="plan-ex__numbers">
        <span>
          <strong>{item.sets}</strong>
          <em>sér</em>
        </span>
        <span>
          <strong>
            {mode === 'time'
              ? `${item.work_seconds ?? 45}s`
              : repRange(item.rep_min, item.rep_max)}
          </strong>
          <em>{mode === 'time' ? 'tempo' : 'reps'}</em>
        </span>
        <span>
          <strong>{item.rest_seconds}s</strong>
          <em>desc</em>
        </span>
      </div>

      {open && (
        <div className="plan-ex__edit">
          <div className="field">
            <span className="field__label">Conta-se em</span>
            <div className="row row--wrap">
              <button
                type="button"
                className={`chip ${item.mode === null ? 'chip--on' : ''}`}
                onClick={() => patch({ mode: null })}
              >
                Como o treino
              </button>
              {(
                [
                  ['reps', 'Repetições'],
                  ['time', 'Tempo'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${item.mode === value ? 'chip--on' : ''}`}
                  onClick={() => patch({ mode: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <label className="field">
              <span className="field__label">Séries</span>
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                defaultValue={item.sets}
                onBlur={(event) => patch({ sets: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field__label">Descanso (s)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={600}
                step={15}
                defaultValue={item.rest_seconds}
                onBlur={(event) => patch({ rest_seconds: Number(event.target.value) })}
              />
            </label>
            {mode === 'time' && (
              <label className="field">
                <span className="field__label">Duração (s)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={3600}
                  step={5}
                  defaultValue={item.work_seconds ?? 45}
                  onBlur={(event) => patch({ work_seconds: Number(event.target.value) })}
                />
              </label>
            )}
            {mode === 'reps' && (
              <>
                <label className="field">
                  <span className="field__label">Reps mín.</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={item.rep_min ?? ''}
                    onBlur={(event) =>
                      patch({
                        rep_min:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Reps máx.</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={item.rep_max ?? ''}
                    onBlur={(event) =>
                      patch({
                        rep_max:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>

          <label className="field">
            <span className="field__label">Nota para o aluno</span>
            <input
              className="input"
              defaultValue={item.notes ?? ''}
              placeholder="Técnica, amplitude, o que vigiar"
              onBlur={(event) => patch({ notes: event.target.value || null })}
            />
          </label>

          <div className="row">
            <button
              type="button"
              className="btn btn--sm btn--quiet"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
            >
              ↑ Subir
            </button>
            <button
              type="button"
              className="btn btn--sm btn--quiet"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
            >
              ↓ Descer
            </button>
            <button
              type="button"
              className="btn btn--sm btn--quiet plan-ex__remove"
              onClick={async () => {
                await removePlanExercise(item.id)
                onChange()
              }}
            >
              Remover
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Como corre este treino: por repetições ou no relógio, e em que ordem. */
function DaySettings({ day, onChanged }: { day: PlanDay; onChanged: () => void }) {
  async function patch(values: Partial<PlanDay>) {
    unwrap(await supabase.from('plan_days').update(values).eq('id', day.id).select())
    onChanged()
  }

  return (
    <section className="card">
      <label className="field">
        <span className="field__label">Nome do treino {day.label}</span>
        <input
          className="input"
          defaultValue={day.title ?? ''}
          placeholder="Empurrar, Pernas, Full body…"
          onBlur={(event) => {
            if (event.target.value !== (day.title ?? '')) {
              void patch({ title: event.target.value || null })
            }
          }}
        />
      </label>

      <div className="field">
        <span className="field__label">Este treino conta-se em</span>
        <div className="row">
          {(
            [
              ['reps', 'Repetições'],
              ['time', 'Tempo'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${day.mode === value ? 'chip--on' : ''}`}
              onClick={() => day.mode !== value && patch({ mode: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="field__hint">
          {day.mode === 'time'
            ? 'A app conduz o treino com temporizador, e o aluno só tem de seguir.'
            : 'O aluno regista carga, repetições e reps em reserva em cada série.'}
        </span>
      </div>

      {day.mode === 'time' && (
        <>
          <div className="field">
            <span className="field__label">Ordem</span>
            <div className="row">
              {(
                [
                  ['sets', 'Série a série'],
                  ['circuit', 'Circuito'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${day.flow === value ? 'chip--on' : ''}`}
                  onClick={() => day.flow !== value && patch({ flow: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="field__hint">
              {day.flow === 'circuit'
                ? 'Percorre a lista toda e repete a volta.'
                : 'Faz as séries todas de um exercício antes de passar ao seguinte.'}
            </span>
          </div>

          {day.flow === 'circuit' && (
            <div className="grid-2">
              <label className="field">
                <span className="field__label">Voltas</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={day.rounds ?? 3}
                  onBlur={(event) => patch({ rounds: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span className="field__label">Descanso entre voltas (s)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={900}
                  step={15}
                  defaultValue={day.round_rest_seconds ?? 60}
                  onBlur={(event) =>
                    patch({ round_rest_seconds: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          )}
        </>
      )}
    </section>
  )
}
