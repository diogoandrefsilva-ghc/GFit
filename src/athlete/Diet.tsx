import { useMemo, useState } from 'react'
import { useProfile } from '@/auth/useAuth'
import { Empty, Loading, ScreenHeader, Stat } from '@/components/Screen'
import { fetchCurrentTargets, fetchDailyLog, fetchDietPlan, saveDailyLog } from '@/lib/api'
import { EMPTY_MACROS, addMacros, macrosOf, type Macros } from '@/lib/calc'
import { int, isoDate, num } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './diet.css'

export function Diet() {
  const profile = useProfile()
  const today = isoDate()
  const [open, setOpen] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)

  const { data, loading, error, reload } = useQuery(['dieta', profile.id, today], async () => {
    const [diet, targets, log] = await Promise.all([
      fetchDietPlan(profile.id),
      fetchCurrentTargets(profile.id),
      fetchDailyLog(profile.id, today),
    ])
    return { diet, targets, log }
  })

  const totals = useMemo(() => {
    if (!data?.diet) return EMPTY_MACROS
    return data.diet.meals.reduce<Macros>(
      (sum, meal) => addMacros(sum, macrosOf(data.diet!.itemsByMeal.get(meal.id) ?? [])),
      EMPTY_MACROS,
    )
  }, [data?.diet])

  if (loading) return <Loading label="A carregar a dieta" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { diet, targets: goals, log } = data!

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

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={diet.plan.variant ?? 'Plano alimentar'}
        title={diet.plan.name}
        subtitle={`${diet.meals.length} refeições`}
      />

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

      <ul className="meals">
        {diet.meals.map((meal) => {
          const items = diet.itemsByMeal.get(meal.id) ?? []
          const macros = macrosOf(items)
          const expanded = open === meal.id

          return (
            <li key={meal.id} className="card meal">
              <button
                type="button"
                className="meal__head"
                onClick={() => setOpen(expanded ? null : meal.id)}
                aria-expanded={expanded}
              >
                <span className="meal__title">
                  <strong>{meal.name}</strong>
                  {meal.time_hint && <em>{meal.time_hint}</em>}
                </span>
                <span className="meal__kcal">{int(macros.kcal)} kcal</span>
                <span className={`meal__chevron ${expanded ? 'is-open' : ''}`}>▾</span>
              </button>

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
                  {meal.notes && <p className="meal__notes">{meal.notes}</p>}
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
              onClick={async () => {
                await saveDailyLog(profile.id, today, {
                  kcal_in: Math.round(totals.kcal),
                  protein_g: Math.round(totals.protein),
                  fat_g: Math.round(totals.fat),
                  carb_g: Math.round(totals.carb),
                })
                reload()
              }}
            >
              Cumpri o plano
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
