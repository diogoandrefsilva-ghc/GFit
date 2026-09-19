import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loading, ScreenHeader } from "@/components/Screen";
import { ExercisePicker } from "@/coach/ExercisePicker";
import { PlanSchedule } from "@/coach/PlanSchedule";
import { MuscleThumb } from "@/components/MuscleThumb";
import { MuscleWork } from "@/components/MuscleWork";
import {
  addExerciseToDay,
  fetchAthleteProfile,
  fetchLimitations,
  fetchMuscles,
  fetchPlanDetail,
  fetchPlanSchedule,
  publishPlan,
  removePlanExercise,
  updatePlanExercise,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { WEEKLY_FULL_SETS, weeklyVolume } from "@/lib/calc";
import { plural, repRange, restLabel, titleCase } from "@/lib/format";
import { unwrap, useQuery } from "@/lib/useQuery";
import type {
  Exercise,
  PlanDay,
  PlanExercise,
  WorkMode,
} from "@/lib/database.types";
import "./plan-editor.css";

export function PlanEditor() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [scope, setScope] = useState<"day" | "plan">("day");

  const { data, loading, error, reload, mutate } = useQuery(
    ["plano", planId],
    async () => {
      const detail = await fetchPlanDetail(planId!);
      const [muscles, limitations, schedules, ficha] = await Promise.all([
        fetchMuscles(),
        fetchLimitations(detail.plan.athlete_id),
        fetchPlanSchedule(planId!),
        fetchAthleteProfile(detail.plan.athlete_id),
      ]);
      // Só as que ainda vigoram: é o que condiciona o plano que se vai escrever.
      return {
        ...detail,
        muscles,
        schedules,
        ficha,
        limitations: limitations.filter((l) => !l.resolved_on),
      };
    },
  );

  const dayId = activeDay ?? data?.days[0]?.id ?? null;

  const dayVolume = useMemo(() => {
    if (!data || !dayId) return new Map<string, number>();
    return weeklyVolume(data.exercisesByDay.get(dayId) ?? [], data.library);
  }, [data, dayId]);

  // Os dias do plano são o microciclo: somados, dão o volume da semana.
  const planVolume = useMemo(() => {
    if (!data) return new Map<string, number>();
    const all = data.days.flatMap(
      (item) => data.exercisesByDay.get(item.id) ?? [],
    );
    return weeklyVolume(all, data.library);
  }, [data]);

  if (loading) return <Loading label="A carregar o plano" />;
  if (error || !data) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <p className="error-banner">{error ?? "Plano não encontrado."}</p>
        </div>
      </div>
    );
  }

  const {
    plan,
    days,
    exercisesByDay,
    library,
    muscles,
    athlete,
    limitations,
    schedules,
    ficha,
  } = data;
  const day = days.find((item) => item.id === dayId) ?? null;
  const items = day ? (exercisesByDay.get(day.id) ?? []) : [];
  const muscleNames = new Map(
    muscles.map((muscle) => [muscle.slug, muscle.name]),
  );
  const volume = scope === "day" ? dayVolume : planVolume;

  return (
    <div className="app">
      <div className="screen screen--plain">
        <ScreenHeader
          back={() => navigate(`/alunos/${plan.athlete_id}`, { replace: true })}
          eyebrow={athlete?.full_name ?? undefined}
          title={plan.name}
          subtitle={
            plan.status === "published"
              ? `Publicado · ${plan.num_weeks} semanas`
              : "Rascunho · o aluno ainda não vê"
          }
        />

        {limitations.length > 0 && (
          <section className="card card--warn">
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
              className={`chip ${item.id === dayId ? "chip--on" : ""}`}
              onClick={() => setActiveDay(item.id)}
            >
              {item.label}
              {item.title ? ` · ${item.title}` : ""}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={async () => {
              const next = String.fromCharCode(65 + days.length);
              const rows = unwrap(
                await supabase
                  .from("plan_days")
                  .insert({
                    plan_id: plan.id,
                    label: next,
                    sort_order: days.length,
                  })
                  .select(),
              );
              setActiveDay(rows[0].id);
              reload();
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
              dayMode={day?.mode ?? "reps"}
              exercise={
                item.exercise_id
                  ? (library.get(item.exercise_id) ?? null)
                  : null
              }
              muscleNames={muscleNames}
              sex={ficha?.sex}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onChange={reload}
              onMove={async (direction) => {
                const other = items[index + direction];
                if (!other) return;
                // A troca aparece no toque e o servidor confirma por baixo.
                // Se falhar, relê-se: o ecrã não pode ficar a mostrar uma
                // ordem que não chegou a ficar gravada.
                mutate((current) => {
                  const reordered = (current.exercisesByDay.get(day!.id) ?? [])
                    .map((row) =>
                      row.id === item.id
                        ? { ...row, sort_order: other.sort_order }
                        : row.id === other.id
                          ? { ...row, sort_order: item.sort_order }
                          : row,
                    )
                    .sort((a, b) => a.sort_order - b.sort_order);
                  const exercisesByDay = new Map(current.exercisesByDay);
                  exercisesByDay.set(day!.id, reordered);
                  return { ...current, exercisesByDay };
                });
                try {
                  await Promise.all([
                    updatePlanExercise(item.id, {
                      sort_order: other.sort_order,
                    }),
                    updatePlanExercise(other.id, {
                      sort_order: item.sort_order,
                    }),
                  ]);
                } catch {
                  reload();
                }
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
        {(dayVolume.size > 0 || planVolume.size > 0) && (
          <section className="card card--flat">
            <div className="card__head">
              <span className="eyebrow">
                {scope === "day"
                  ? `Volume do treino ${day?.label ?? ""} · ${plural(items.length, "exercício", "exercícios")}`
                  : `Volume da semana · ${plural(days.length, "treino", "treinos")}`}
              </span>
              <div className="row plan__scope">
                {(
                  [
                    ["day", "Este treino"],
                    ["plan", "Semana toda"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip ${scope === key ? "chip--on" : ""}`}
                    onClick={() => setScope(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <MuscleWork
              volume={volume}
              names={muscleNames}
              sex={ficha?.sex}
              /* Um treino lê-se em relação ao músculo mais trabalhado; a semana
                 em relação ao que se considera uma semana servida. */
              reference={scope === "plan" ? WEEKLY_FULL_SETS : undefined}
              note={
                scope === "plan"
                  ? `A cor cheia são ${WEEKLY_FULL_SETS} séries na semana. Os auxiliares contam 0,5 ou 0,3 como na planilha.`
                  : "Séries por músculo, com os auxiliares a contar 0,5 ou 0,3 como na planilha."
              }
            />
          </section>
        )}

        <PlanSchedule
          plan={plan}
          days={days}
          activeDay={day}
          schedules={schedules}
          onChanged={reload}
        />

        <div className="row plan__actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() =>
              navigate(`/alunos/${plan.athlete_id}`, { replace: true })
            }
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            disabled={plan.status === "published"}
            onClick={async () => {
              await publishPlan(plan.id);
              reload();
            }}
          >
            {plan.status === "published" ? "Publicado ✓" : "Publicar ao aluno"}
          </button>
        </div>
      </div>

      {picking && day && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (exercise) => {
            await addExerciseToDay(day.id, exercise, items.length);
            reload();
          }}
        />
      )}
    </div>
  );
}

const SETS = [1, 2, 3, 4, 5, 6, 8, 10];
const REP_RANGES = [
  [4, 6],
  [5, 8],
  [6, 8],
  [6, 10],
  [8, 10],
  [8, 12],
  [10, 12],
  [10, 15],
  [12, 15],
  [12, 20],
  [15, 20],
  [20, 30],
];
const WORK_SECONDS = [15, 20, 30, 40, 45, 60, 75, 90, 120, 180];
const REST_SECONDS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const DEFAULT_WORK_SECONDS = 45;

/** O valor que já lá está entra sempre na lista, por mais fora do comum que seja. */
function numberOptions(
  values: number[],
  current: number,
  label: (value: number) => string,
): Option[] {
  const all = values.includes(current)
    ? values
    : [...values, current].sort((a, b) => a - b);
  return all.map((value) => ({ value: String(value), label: label(value) }));
}

function repKey(min: number | null, max: number | null): string {
  return `${min ?? ""}-${max ?? ""}`;
}

function repOptions(min: number | null, max: number | null): Option[] {
  const options = REP_RANGES.map(([from, to]) => ({
    value: `${from}-${to}`,
    label: `${from}-${to}`,
  }));
  const current = repKey(min, max);
  if (!options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: repRange(min, max) });
  }
  return options;
}

interface Option {
  value: string;
  label: string;
}

/** Um número do exercício, escolhido de uma lista curta em vez de escrito. */
function Picker({
  label,
  value,
  options,
  onChange,
  onCustom,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onCustom: () => void;
}) {
  return (
    <label className="plan-ex__pick">
      <select
        className="plan-ex__select"
        value={value}
        aria-label={label}
        onChange={(event) =>
          event.target.value === CUSTOM
            ? onCustom()
            : onChange(event.target.value)
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM}>outro…</option>
      </select>
      <em>{label}</em>
    </label>
  );
}

const CUSTOM = "__custom__";

function PlanExerciseRow({
  item,
  dayMode,
  exercise,
  muscleNames,
  sex,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
}: {
  item: PlanExercise;
  dayMode: WorkMode;
  exercise: Exercise | null;
  muscleNames: Map<string, string>;
  sex: "M" | "F" | null | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: () => void;
  onMove: (direction: 1 | -1) => void;
}) {
  const [open, setOpen] = useState(false);
  const mode = item.mode ?? dayMode;

  async function patch(values: Partial<PlanExercise>) {
    await updatePlanExercise(item.id, values);
    onChange();
  }

  return (
    <li className="plan-ex">
      <div className="plan-ex__body">
        <MuscleThumb
          muscles={exercise?.muscles ?? []}
          names={muscleNames}
          sex={sex}
        />

        <div className="plan-ex__main">
          <div className="plan-ex__head">
            <span className="plan-ex__text">
              <strong>
                {titleCase(item.name_override ?? exercise?.name ?? "Exercício")}
              </strong>
              <em>
                {titleCase(
                  [exercise?.category, exercise?.equipment]
                    .filter(Boolean)
                    .join(" · "),
                ) || "sem categoria"}
                {exercise?.video_url ? " · vídeo" : ""}
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

          {/*
        Séries, repetições e descanso mudam-se aqui mesmo, sem abrir nada: são
        os três números que se mexem a toda a hora e quase sempre para valores
        do costume. O que fugir à lista escolhe-se em "outro…", que abre o
        painel com os campos livres.
      */}
          <div className="plan-ex__numbers">
            <Picker
              label="séries"
              value={String(item.sets)}
              options={numberOptions(SETS, item.sets, (value) => String(value))}
              onChange={(value) => patch({ sets: Number(value) })}
              onCustom={() => setOpen(true)}
            />
            {mode === "time" ? (
              <Picker
                label="tempo"
                value={String(item.work_seconds ?? DEFAULT_WORK_SECONDS)}
                options={numberOptions(
                  WORK_SECONDS,
                  item.work_seconds ?? DEFAULT_WORK_SECONDS,
                  (value) => `${value}s`,
                )}
                onChange={(value) => patch({ work_seconds: Number(value) })}
                onCustom={() => setOpen(true)}
              />
            ) : (
              <Picker
                label="reps"
                value={repKey(item.rep_min, item.rep_max)}
                options={repOptions(item.rep_min, item.rep_max)}
                onChange={(value) => {
                  const [min, max] = value.split("-");
                  patch({
                    rep_min: min === "" ? null : Number(min),
                    rep_max: max === "" ? null : Number(max),
                  });
                }}
                onCustom={() => setOpen(true)}
              />
            )}
            <Picker
              label="descanso"
              value={String(item.rest_seconds)}
              options={numberOptions(
                REST_SECONDS,
                item.rest_seconds,
                restLabel,
              )}
              onChange={(value) => patch({ rest_seconds: Number(value) })}
              onCustom={() => setOpen(true)}
            />
          </div>
        </div>
      </div>

      {open && (
        <div className="plan-ex__edit">
          <p className="field__hint">
            Aqui ficam o modo, a nota, a ordem e os números que fogem à lista.
          </p>
          <div className="field">
            <span className="field__label">Conta-se em</span>
            <div className="row row--wrap">
              <button
                type="button"
                className={`chip ${item.mode === null ? "chip--on" : ""}`}
                onClick={() => patch({ mode: null })}
              >
                Como o treino
              </button>
              {(
                [
                  ["reps", "Repetições"],
                  ["time", "Tempo"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${item.mode === value ? "chip--on" : ""}`}
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
                key={item.sets}
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
                key={item.rest_seconds}
                defaultValue={item.rest_seconds}
                onBlur={(event) =>
                  patch({ rest_seconds: Number(event.target.value) })
                }
              />
            </label>
            {mode === "time" && (
              <label className="field">
                <span className="field__label">Duração (s)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={3600}
                  step={5}
                  key={item.work_seconds ?? DEFAULT_WORK_SECONDS}
                  defaultValue={item.work_seconds ?? DEFAULT_WORK_SECONDS}
                  onBlur={(event) =>
                    patch({ work_seconds: Number(event.target.value) })
                  }
                />
              </label>
            )}
            {mode === "reps" && (
              <>
                <label className="field">
                  <span className="field__label">Reps mín.</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={60}
                    key={item.rep_min ?? ""}
                    defaultValue={item.rep_min ?? ""}
                    onBlur={(event) =>
                      patch({
                        rep_min:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
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
                    key={item.rep_max ?? ""}
                    defaultValue={item.rep_max ?? ""}
                    onBlur={(event) =>
                      patch({
                        rep_max:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
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
              defaultValue={item.notes ?? ""}
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
                await removePlanExercise(item.id);
                onChange();
              }}
            >
              Remover
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Como corre este treino: por repetições ou no relógio, e em que ordem. */
function DaySettings({
  day,
  onChanged,
}: {
  day: PlanDay;
  onChanged: () => void;
}) {
  async function patch(values: Partial<PlanDay>) {
    unwrap(
      await supabase.from("plan_days").update(values).eq("id", day.id).select(),
    );
    onChanged();
  }

  return (
    <section className="card">
      <label className="field">
        <span className="field__label">Nome do treino {day.label}</span>
        <input
          className="input"
          defaultValue={day.title ?? ""}
          placeholder="Empurrar, Pernas, Full body…"
          onBlur={(event) => {
            if (event.target.value !== (day.title ?? "")) {
              void patch({ title: event.target.value || null });
            }
          }}
        />
      </label>

      <div className="field">
        <span className="field__label">Este treino conta-se em</span>
        <div className="row">
          {(
            [
              ["reps", "Repetições"],
              ["time", "Tempo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${day.mode === value ? "chip--on" : ""}`}
              onClick={() => day.mode !== value && patch({ mode: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="field__hint">
          {day.mode === "time"
            ? "A app conduz o treino com temporizador, e o aluno só tem de seguir."
            : "O aluno regista carga, repetições e reps em reserva em cada série."}
        </span>
      </div>

      {day.mode === "time" && (
        <>
          <div className="field">
            <span className="field__label">Ordem</span>
            <div className="row">
              {(
                [
                  ["sets", "Série a série"],
                  ["circuit", "Circuito"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${day.flow === value ? "chip--on" : ""}`}
                  onClick={() => day.flow !== value && patch({ flow: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="field__hint">
              {day.flow === "circuit"
                ? "Percorre a lista toda e repete a volta."
                : "Faz as séries todas de um exercício antes de passar ao seguinte."}
            </span>
          </div>

          {day.flow === "circuit" && (
            <div className="grid-2">
              <label className="field">
                <span className="field__label">Voltas</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={day.rounds ?? 3}
                  onBlur={(event) =>
                    patch({ rounds: Number(event.target.value) })
                  }
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
  );
}
