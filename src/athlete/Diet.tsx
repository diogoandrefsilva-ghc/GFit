import { useMemo, useState } from 'react'
import { useProfile } from '@/auth/useAuth'
import { Empty, Loading, ScreenHeader, Stat } from '@/components/Screen'
import { Segmented } from '@/components/Segmented'
import {
  fetchCurrentTargets,
  fetchDailyLog,
  fetchDietPlan,
  fetchMealLogs,
  saveDailyLog,
  setMealDone,
  soft,
} from '@/lib/api'
import { EMPTY_MACROS, macrosOf, type Macros } from '@/lib/calc'
import { eatenMacros, eatenOption, mealSlots, planMacros, type MealSlot } from '@/lib/diet'
import { int, isoDate, num } from '@/lib/format'
import { describeError } from '@/lib/supabase'
import { useQuery } from '@/lib/useQuery'
import type { DietMeal } from '@/lib/database.types'
import './diet.css'

export function Diet() {
  const profile = useProfile()
  const today = isoDate()
  const [open, setOpen] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  // A opção que se está a ver em cada refeição, enquanto não se marca nenhuma.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)

  const { data, loading, error, reload, mutate } = useQuery(
    ['dieta', profile.id, today],
    async () => {
      const [diet, targets, log, mealLogs] = await Promise.all([
        fetchDietPlan(profile.id),
        fetchCurrentTargets(profile.id),
        fetchDailyLog(profile.id, today),
        soft(fetchMealLogs(profile.id, today), []),
      ])
      return { diet, targets, log, mealLogs }
    },
  )

  const slots = useMemo(() => mealSlots(data?.diet?.meals ?? []), [data?.diet])

  // O total do plano é uma opção por refeição — a primeira. As alternativas
  // são para escolher, não para somar.
  const totals = useMemo(
    () => (data?.diet ? planMacros(slots, data.diet.itemsByMeal) : EMPTY_MACROS),
    [data?.diet, slots],
  )

  if (loading) return <Loading label="A carregar a dieta" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { diet, targets: goals, log } = data!
  const mealLogs = data!.mealLogs ?? []

  const targets = {
    kcal: diet?.plan.kcal_target ?? goals?.kcal_target ?? null,
    protein: diet?.plan.protein_target_g ?? goals?.protein_target_g ?? null,
    fat: diet?.plan.fat_target_g ?? goals?.fat_target_g ?? null,
    carb: diet?.plan.carb_target_g ?? goals?.carb_target_g ?? null,
  }

  if (!diet) {
    return (
      <div className="screen">
        <ScreenHeader title="Dieta" />
        <Empty
          title="Ainda sem plano alimentar"
          hint="O treinador ainda não publicou nenhum plano alimentar para ti."
        />
      </div>
    )
  }

  const eatenCount = slots.filter((slot) => eatenOption(slot, mealLogs, today)).length
  const eaten = eatenMacros(slots, diet.itemsByMeal, mealLogs, today)

  /**
   * Marca as refeições dadas como feitas (ou desfaz uma). O ecrã muda no
   * toque; a gravação vai atrás, e com ela o "hoje comi" do registo diário —
   * que é o que o treinador vê —, somado a partir do que ficou marcado.
   */
  async function mark(changes: { slot: MealSlot; option: DietMeal; done: boolean }[]) {
    if (changes.length === 0) return
    let next = mealLogs
    for (const { slot, option, done } of changes) {
      const ids = slot.options.map((item) => item.id)
      next = next.filter((entry) => entry.log_date !== today || !ids.includes(entry.meal_id))
      if (done) {
        next = [
          ...next,
          {
            athlete_id: profile.id,
            log_date: today,
            meal_id: option.id,
            created_at: new Date().toISOString(),
          },
        ]
      }
    }
    mutate((current) => ({ ...current, mealLogs: next }))
    setFailure(null)

    try {
      for (const { slot, option, done } of changes) {
        await setMealDone(
          profile.id,
          today,
          option.id,
          done,
          slot.options.map((item) => item.id),
        )
      }
      const sum = eatenMacros(slots, diet!.itemsByMeal, next, today)
      const any = slots.some((slot) => eatenOption(slot, next, today))
      await saveDailyLog(profile.id, today, {
        kcal_in: any ? Math.round(sum.kcal) : null,
        protein_g: any ? Math.round(sum.protein) : null,
        fat_g: any ? Math.round(sum.fat) : null,
        carb_g: any ? Math.round(sum.carb) : null,
      })
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      reload()
    }
  }

  /** A opção à vista numa refeição: a que se comeu, a que se escolheu ver, ou a do plano. */
  const shown = (slot: MealSlot): DietMeal =>
    eatenOption(slot, mealLogs, today) ??
    slot.options.find((option) => option.id === picked[slot.meal.id]) ??
    slot.meal

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={diet.plan.variant ?? 'Plano alimentar'}
        title={diet.plan.name}
        subtitle={`${slots.length} refeições`}
      />

      {/* ── hoje ───────────────────────────────────────── */}
      <section className={`card diet__today ${eatenCount === slots.length && slots.length > 0 ? 'card--good' : ''}`}>
        <div className="card__head">
          <span className="eyebrow">Hoje</span>
          <strong className="diet__today-count">
            {eatenCount} de {slots.length} refeições
          </strong>
        </div>
        <div
          className="diet__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={slots.length}
          aria-valuenow={eatenCount}
        >
          <span
            style={{ width: `${slots.length ? (eatenCount / slots.length) * 100 : 0}%` }}
          />
        </div>
        <p className="diet__today-kcal muted">
          {eatenCount > 0
            ? `${int(eaten.kcal)} de ${int(totals.kcal)} kcal · P ${num(eaten.protein, 0)} g · G ${num(eaten.fat, 0)} g · H ${num(eaten.carb, 0)} g`
            : 'Marca cada refeição quando a comeres.'}
        </p>
      </section>

      <section className="card">
        <span className="eyebrow">Total do plano</span>
        <div className="diet__totals">
          <Stat
            label="Kcal"
            value={int(totals.kcal)}
            hint={targets.kcal ? `meta ${int(targets.kcal)}` : undefined}
          />
          <Stat
            label="Proteína"
            value={`${num(totals.protein, 0)} g`}
            hint={targets.protein ? `meta ${targets.protein} g` : undefined}
          />
        </div>
        <div className="diet__totals">
          <Stat
            label="Gordura"
            value={`${num(totals.fat, 0)} g`}
            hint={targets.fat ? `meta ${targets.fat} g` : undefined}
          />
          <Stat
            label="Hidratos"
            value={`${num(totals.carb, 0)} g`}
            hint={targets.carb ? `meta ${targets.carb} g` : undefined}
          />
        </div>
      </section>

      {failure && <p className="error-banner">{failure}</p>}

      <ul className="meals">
        {slots.map((slot) => {
          const option = shown(slot)
          const done = Boolean(eatenOption(slot, mealLogs, today))
          const items = diet.itemsByMeal.get(option.id) ?? []
          const macros = macrosOf(items)
          const expanded = open === slot.meal.id

          return (
            <li key={slot.meal.id} className={`card meal ${done ? 'is-done' : ''}`}>
              <div className="meal__row">
                <button
                  type="button"
                  className="meal__head"
                  onClick={() => setOpen(expanded ? null : slot.meal.id)}
                  aria-expanded={expanded}
                >
                  <span className="meal__title">
                    <strong>{slot.meal.name}</strong>
                    {slot.meal.time_hint && <em>{slot.meal.time_hint}</em>}
                  </span>
                  <span className="meal__kcal">{int(macros.kcal)} kcal</span>
                  <span className={`meal__chevron ${expanded ? 'is-open' : ''}`}>▾</span>
                </button>
                <button
                  type="button"
                  className="meal__check"
                  aria-pressed={done}
                  aria-label={
                    done
                      ? `Desmarcar ${slot.meal.name}`
                      : `Marcar ${slot.meal.name} como feita`
                  }
                  onClick={() => mark([{ slot, option, done: !done }])}
                >
                  {done ? '✓' : ''}
                </button>
              </div>

              {/* As alternativas escolhem-se sem abrir a refeição: é a
                  pergunta que se faz à hora de comer. */}
              {slot.options.length > 1 && (
                <div className="meal__options">
                  <Segmented
                    value={option.id}
                    options={slot.options.map(
                      (item, index) => [item.id, `Opção ${index + 1}`] as const,
                    )}
                    onChange={(id) => {
                      setPicked((current) => ({ ...current, [slot.meal.id]: id }))
                      // Com a refeição já marcada, mudar de opção é dizer que
                      // afinal se comeu a outra.
                      const chosen = slot.options.find((item) => item.id === id)
                      if (done && chosen) mark([{ slot, option: chosen, done: true }])
                    }}
                    label={`Opções de ${slot.meal.name}`}
                  />
                </div>
              )}

              {expanded && (
                <>
                  <ul className="meal__items">
                    {items.length === 0 && (
                      <li className="muted">Refeição sem alimentos.</li>
                    )}
                    {items.map((item) => (
                      <li key={item.id} className="meal__item">
                        <span className="meal__item-name">{item.name}</span>
                        <span className="meal__item-qty">
                          {num(item.quantity, 0)} {item.unit}
                        </span>
                        <span className="meal__item-macros">
                          P {num(item.protein_g, 0)} · G {num(item.fat_g, 0)} · H{' '}
                          {num(item.carb_g, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="meal__totals">
                    P {num(macros.protein, 0)} g · G {num(macros.fat, 0)} g · H{' '}
                    {num(macros.carb, 0)} g
                  </p>
                  {option.notes && <p className="meal__notes">{option.notes}</p>}
                </>
              )}
            </li>
          )
        })}
      </ul>

      {/* Registar o que se comeu mesmo, que nem sempre é o plano. */}
      <section className="card card--flat">
        <div className="card__head">
          <span className="eyebrow">Hoje comi</span>
          {log?.kcal_in ? (
            <span className="chip chip--good">{int(log.kcal_in)} kcal registadas</span>
          ) : null}
        </div>

        {logging ? (
          <IntakeForm
            initial={log}
            plan={totals}
            saving={false}
            onCancel={() => setLogging(false)}
            onSave={async (values) => {
              await saveDailyLog(profile.id, today, values)
              setLogging(false)
              reload()
            }}
          />
        ) : (
          <div className="row">
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              disabled={slots.length === 0 || eatenCount === slots.length}
              onClick={() =>
                // Cumprir o plano é ter comido tudo: marca o que faltava, na
                // opção que estiver à vista em cada refeição.
                mark(
                  slots
                    .filter((slot) => !eatenOption(slot, mealLogs, today))
                    .map((slot) => ({ slot, option: shown(slot), done: true })),
                )
              }
            >
              {eatenCount === slots.length && slots.length > 0
                ? 'Plano cumprido ✓'
                : 'Cumpri o plano'}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setLogging(true)}
            >
              Registar outros valores
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function IntakeForm({
  initial,
  plan,
  saving,
  onSave,
  onCancel,
}: {
  initial: { kcal_in: number | null; protein_g: number | null; fat_g: number | null; carb_g: number | null } | null
  plan: Macros
  saving: boolean
  onSave: (values: {
    kcal_in: number | null
    protein_g: number | null
    fat_g: number | null
    carb_g: number | null
  }) => void
  onCancel: () => void
}) {
  const [kcal, setKcal] = useState(String(initial?.kcal_in ?? Math.round(plan.kcal)))
  const [protein, setProtein] = useState(
    String(initial?.protein_g ?? Math.round(plan.protein)),
  )
  const [fat, setFat] = useState(String(initial?.fat_g ?? Math.round(plan.fat)))
  const [carb, setCarb] = useState(String(initial?.carb_g ?? Math.round(plan.carb)))

  const toNumber = (value: string) => (value === '' ? null : Number(value))

  return (
    <div className="intake">
      <div className="grid-2">
        <label className="field">
          <span className="field__label">Kcal</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(event) => setKcal(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Proteína (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={protein}
            onChange={(event) => setProtein(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Gordura (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={fat}
            onChange={(event) => setFat(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Hidratos (g)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={carb}
            onChange={(event) => setCarb(event.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <button type="button" className="btn btn--quiet btn--sm" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={saving}
          onClick={() =>
            onSave({
              kcal_in: toNumber(kcal),
              protein_g: toNumber(protein),
              fat_g: toNumber(fat),
              carb_g: toNumber(carb),
            })
          }
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
