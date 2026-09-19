import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loading, ScreenHeader } from "@/components/Screen";
import { ExercisePicker } from "@/coach/ExercisePicker";
import { PlanSchedule } from "@/coach/PlanSchedule";
import { MuscleThumb } from "@/components/MuscleThumb";
import { NumberSheet, RangeSheet, type Range } from "@/components/NumberSheet";
import { Segmented } from "@/components/Segmented";
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
const REP_RANGES: Range[] = [
  { min: 4, max: 6 },
  { min: 5, max: 8 },
  { min: 6, max: 8 },
  { min: 6, max: 10 },
  { min: 8, max: 10 },
  { min: 8, max: 12 },
  { min: 10, max: 12 },
  { min: 10, max: 15 },
  { min: 12, max: 15 },
  { min: 12, max: 20 },
  { min: 15, max: 20 },
  { min: 20, max: 30 },
];
const WORK_SECONDS = [15, 20, 30, 40, 45, 60, 75, 90, 120, 180];
const REST_SECONDS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const DEFAULT_WORK_SECONDS = 45;
const DEFAULT_REPS: Range = { min: 8, max: 12 };

/** Qual dos números do exercício está aberto para ser mudado. */
type Editing = "sets" | "reps" | "time" | "rest";

/**
 * Um dos três números do exercício. Lê-se de relance na lista e abre-se ao
 * toque — o valor manda no tamanho, o nome fica por baixo em letra pequena.
 */
function NumberCell({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="plan-ex__num"
      onClick={onOpen}
      aria-label={`${label}: ${value}. Alterar.`}
    >
      <span className="plan-ex__num-value">{value}</span>
      <span className="plan-ex__num-label">{label}</span>
    </button>
  );
}

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
  const [editing, setEditing] = useState<Editing | null>(null);
  const mode = item.mode ?? dayMode;
  const name = titleCase(item.name_override ?? exercise?.name ?? "Exercício");
  const work = item.work_seconds ?? DEFAULT_WORK_SECONDS;

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
              <strong>{name}</strong>
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
            Séries, repetições e descanso são os três números que se mexem a
            toda a hora: ficam à vista num carril só, e o toque em qualquer
            deles abre o painel do fundo com os valores do costume e os
            botões para afinar o que fugir à lista.
          */}
          <div className="plan-ex__numbers">
            <NumberCell
              label="séries"
              value={String(item.sets)}
              onOpen={() => setEditing("sets")}
            />
            {mode === "time" ? (
              <NumberCell
                label="tempo"
                value={restLabel(work)}
                onOpen={() => setEditing("time")}
              />
            ) : (
              <NumberCell
                label="reps"
                value={repRange(item.rep_min, item.rep_max)}
                onOpen={() => setEditing("reps")}
              />
            )}
            <NumberCell
              label="descanso"
              value={restLabel(item.rest_seconds)}
              onOpen={() => setEditing("rest")}
            />
          </div>
        </div>
      </div>

      {editing === "sets" && (
        <NumberSheet
          title="Séries"
          caption={name}
          value={item.sets}
          presets={SETS}
          min={1}
          max={20}
          format={(value) => String(value)}
          hint="Quantas vezes se repete o exercício antes de passar ao seguinte."
          onChange={(value) => patch({ sets: value })}
          onClose={() => setEditing(null)}
        />
      )}

      {editing === "reps" && (
        <RangeSheet
          title="Repetições"
          caption={name}
          value={{
            min: item.rep_min ?? DEFAULT_REPS.min,
            max: item.rep_max ?? DEFAULT_REPS.max,
          }}
          presets={REP_RANGES}
          min={1}
          max={60}
          hint="Um intervalo, não um número certo: o aluno fica entre as duas pontas conforme o dia."
          onChange={(range) =>
            patch({ rep_min: range.min, rep_max: range.max })
          }
          onClose={() => setEditing(null)}
        />
      )}

      {editing === "time" && (
        <NumberSheet
          title="Tempo de trabalho"
          caption={name}
          value={work}
          presets={WORK_SECONDS}
          min={5}
          max={1800}
          step={5}
          format={restLabel}
          hint="Quanto tempo dura cada série. É a app que conta."
          onChange={(value) => patch({ work_seconds: value })}
          onClose={() => setEditing(null)}
        />
      )}

      {editing === "rest" && (
        <NumberSheet
          title="Descanso"
          caption={name}
          value={item.rest_seconds}
          presets={REST_SECONDS}
          min={0}
          max={600}
          step={15}
          format={restLabel}
          hint="O que fica entre séries. Mais curto aperta o metabólico, mais longo serve a força."
          onChange={(value) => patch({ rest_seconds: value })}
          onClose={() => setEditing(null)}
        />
      )}

      {open && (
        <div className="plan-ex__edit">
          <div className="field">
            <span className="field__label">Conta-se em</span>
            <Segmented<WorkMode | null>
              value={item.mode}
              options={[
                [null, "Do treino"],
                ["reps", "Repetições"],
                ["time", "Tempo"],
              ]}
              onChange={(value) => patch({ mode: value })}
              label="Como se conta este exercício"
            />
            <span className="field__hint">
              Por norma segue o treino. Muda-se aqui quando é só este exercício
              que vai a relógio — ou ao contrário.
            </span>
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
        <Segmented<WorkMode>
          value={day.mode}
          options={[
            ["reps", "Repetições"],
            ["time", "Tempo"],
          ]}
          onChange={(value) => patch({ mode: value })}
          label="Este treino conta-se em"
        />
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
            <Segmented
              value={day.flow}
              options={[
                ["sets", "Série a série"],
                ["circuit", "Circuito"],
              ]}
              onChange={(value) => patch({ flow: value })}
              label="Ordem do treino"
            />
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
