import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import {
  deleteDietPlan,
  fetchCurrentTargets,
  fetchDietContents,
  fetchFoodUsage,
  searchFoods,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { EMPTY_MACROS, macrosOf, scaleFood } from '@/lib/calc'
import { mealSlots, planMacros } from '@/lib/diet'
import { int, num } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import type { AthleteTargets, DietItem, DietPlan, Food } from '@/lib/database.types'
import './diet-editor.css'

export function DietEditor() {
  const navigate = useNavigate()
  const { dietPlanId } = useParams<{ dietPlanId: string }>()
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const { data, loading, error, reload } = useQuery(['dieta-editor', dietPlanId], async () => {
    const plans = unwrap(
      await supabase.from('diet_plans').select('*').eq('id', dietPlanId!).limit(1),
    )
    let plan = plans[0]
    if (!plan) throw new Error('Plano alimentar não encontrado.')

    // O objectivo do plano alimentar é o das metas do aluno. Um plano que
    // ainda não o tem — as metas vieram depois, ou ficou em branco — assume-o
    // sozinho; quem quiser outro número escreve-o por cima.
    const [targets, usage, contents] = await Promise.all([
      fetchCurrentTargets(plan.athlete_id),
      fetchFoodUsage(),
      fetchDietContents(plan.id),
    ])
    if (plan.kcal_target === null && targets?.kcal_target) {
      const filled = unwrap(
        await supabase
          .from('diet_plans')
          .update({
            kcal_target: targets.kcal_target,
            protein_target_g: plan.protein_target_g ?? targets.protein_target_g,
            fat_target_g: plan.fat_target_g ?? targets.fat_target_g,
            carb_target_g: plan.carb_target_g ?? targets.carb_target_g,
          })
          .eq('id', plan.id)
          .select(),
      )
      plan = filled[0] ?? plan
    }

    return { plan, targets, usage, ...contents }
  })

  const slots = useMemo(() => mealSlots(data?.meals ?? []), [data?.meals])

  // O total do plano conta uma opção por refeição: a primeira. As alternativas
  // são para o aluno escolher, não para somar.
  const totals = useMemo(
    () => (data ? planMacros(slots, data.itemsByMeal) : EMPTY_MACROS),
    [data, slots],
  )

  if (loading) return <Loading label="A carregar a dieta" />
  if (error || !data) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <p className="error-banner">{error ?? 'Plano não encontrado.'}</p>
        </div>
      </div>
    )
  }

  const { plan, meals, itemsByMeal } = data

  const missing = {
    kcal: plan.kcal_target ? plan.kcal_target - totals.kcal : null,
    protein: plan.protein_target_g ? plan.protein_target_g - totals.protein : null,
    fat: plan.fat_target_g ? plan.fat_target_g - totals.fat : null,
    carb: plan.carb_target_g ? plan.carb_target_g - totals.carb : null,
  }

  return (
    <div className="app">
      <div className="screen screen--plain">
        <ScreenHeader
          back={() => navigate(`/alunos/${plan.athlete_id}?ver=planos`, { replace: true })}
          title={plan.name}
          subtitle={
            plan.status === 'published'
              ? 'Publicado'
              : 'Rascunho · o aluno ainda não vê'
          }
        />

        <TargetsCard plan={plan} targets={data.targets ?? null} onSaved={reload} />

        <section className="card card--flat">
          <span className="eyebrow">Total do plano</span>
          <div className="row">
            <Stat
              label="Kcal"
              value={int(totals.kcal)}
              hint={missing.kcal !== null ? `faltam ${int(missing.kcal)}` : undefined}
              tone={
                missing.kcal !== null && Math.abs(missing.kcal) <= 50 ? 'good' : 'default'
              }
            />
            <Stat
              label="Proteína"
              value={`${num(totals.protein, 0)} g`}
              hint={missing.protein !== null ? `faltam ${num(missing.protein, 0)}` : undefined}
            />
          </div>
          <div className="row">
            <Stat
              label="Gordura"
              value={`${num(totals.fat, 0)} g`}
              hint={missing.fat !== null ? `faltam ${num(missing.fat, 0)}` : undefined}
            />
            <Stat
              label="Hidratos"
              value={`${num(totals.carb, 0)} g`}
              hint={missing.carb !== null ? `faltam ${num(missing.carb, 0)}` : undefined}
            />
          </div>
        </section>

        <ul className="diet-edit__meals">
          {slots.map((slot) => (
            <li key={slot.meal.id} className="card diet-edit__meal">
              {slot.options.map((meal, index) => {
                const items = itemsByMeal.get(meal.id) ?? []
                const macros = macrosOf(items)
                const isAlternative = index > 0
                return (
                  <div
                    key={meal.id}
                    className={`diet-edit__option ${isAlternative ? 'is-alternative' : ''}`}
                  >
                    <div className="card__head">
                      {isAlternative ? (
                        <span className="diet-edit__option-label">Opção {index + 1}</span>
                      ) : (
                        <input
                          className="diet-edit__meal-name"
                          defaultValue={meal.name}
                          onBlur={async (event) => {
                            if (event.target.value === meal.name) return
                            unwrap(
                              await supabase
                                .from('diet_meals')
                                .update({ name: event.target.value || 'Refeição' })
                                .eq('id', meal.id)
                                .select(),
                            )
                            reload()
                          }}
                        />
                      )}
                      <span className="diet-edit__meal-kcal">{int(macros.kcal)} kcal</span>
                    </div>

                    {!isAlternative && slot.options.length > 1 && (
                      <span className="diet-edit__option-label">Opção 1 · a que conta no total</span>
                    )}

                    <ul className="diet-edit__items">
                      {items.map((item) => (
                        <ItemRow key={item.id} item={item} onChange={reload} />
                      ))}
                      {items.length === 0 && (
                        <li className="muted diet-edit__no-items">Sem alimentos.</li>
                      )}
                    </ul>

                    <p className="diet-edit__meal-macros">
                      P {num(macros.protein, 0)} · G {num(macros.fat, 0)} · H{' '}
                      {num(macros.carb, 0)}
                    </p>

                    <div className="row row--wrap">
                      <button
                        type="button"
                        className="btn btn--sm btn--quiet"
                        onClick={() => setAddingTo(meal.id)}
                      >
                        + Alimento
                      </button>
                      {!isAlternative && (
                        <button
                          type="button"
                          className="btn btn--sm btn--quiet"
                          onClick={async () => {
                            // Outra opção para a mesma refeição: o aluno
                            // escolhe uma das duas à hora de comer.
                            unwrap(
                              await supabase
                                .from('diet_meals')
                                .insert({
                                  diet_plan_id: plan.id,
                                  name: meal.name,
                                  sort_order: meal.sort_order,
                                  alternative_to: meal.id,
                                })
                                .select(),
                            )
                            reload()
                          }}
                        >
                          + Alternativa
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--sm btn--quiet"
                        onClick={async () => {
                          if (
                            !isAlternative &&
                            slot.options.length > 1 &&
                            !window.confirm(
                              `Remover "${meal.name}" e as suas alternativas?`,
                            )
                          ) {
                            return
                          }
                          unwrap(
                            await supabase
                              .from('diet_meals')
                              .delete()
                              .eq('id', meal.id)
                              .select(),
                          )
                          reload()
                        }}
                      >
                        {isAlternative ? 'Remover alternativa' : 'Remover refeição'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={async () => {
            unwrap(
              await supabase
                .from('diet_meals')
                .insert({
                  diet_plan_id: plan.id,
                  name: `Refeição ${slots.length + 1}`,
                  // Depois da última, e não "quantas há": com refeições
                  // removidas pelo meio, contar dava ordens repetidas.
                  sort_order: Math.max(-1, ...meals.map((meal) => meal.sort_order)) + 1,
                })
                .select(),
            )
            reload()
          }}
        >
          + Adicionar refeição
        </button>

        <div className="row plan__actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => navigate(`/alunos/${plan.athlete_id}?ver=planos`, { replace: true })}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            disabled={plan.status === 'published'}
            onClick={async () => {
              unwrap(
                await supabase
                  .from('diet_plans')
                  .update({ status: 'published', published_at: new Date().toISOString() })
                  .eq('id', plan.id)
                  .select(),
              )
              reload()
            }}
          >
            {plan.status === 'published' ? 'Publicado ✓' : 'Publicar ao aluno'}
          </button>
        </div>

        <button
          type="button"
          className="btn btn--sm btn--quiet btn--danger plan__delete"
          onClick={async () => {
            if (!window.confirm(`Apagar o plano alimentar "${plan.name}"?`)) return
            await deleteDietPlan(plan.id)
            navigate(`/alunos/${plan.athlete_id}?ver=planos`, { replace: true })
          }}
        >
          Apagar plano alimentar
        </button>
      </div>

      {addingTo && (
        <FoodPicker
          mealId={addingTo}
          sortOrder={(itemsByMeal.get(addingTo) ?? []).length}
          usage={data.usage ?? new Map()}
          onClose={() => setAddingTo(null)}
          onAdded={reload}
        />
      )}
    </div>
  )
}

function TargetsCard({
  plan,
  targets,
  onSaved,
}: {
  plan: DietPlan
  /** As metas em vigor do aluno: é delas que o objectivo do plano vem. */
  targets: AthleteTargets | null
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)

  const KEYS = ['kcal_target', 'protein_target_g', 'fat_target_g', 'carb_target_g'] as const
  const fromTargets =
    targets?.kcal_target != null && KEYS.every((key) => (plan[key] ?? null) === (targets[key] ?? null))

  async function patch(values: Partial<DietPlan>) {
    unwrap(await supabase.from('diet_plans').update(values).eq('id', plan.id).select())
    onSaved()
  }

  const toNumber = (value: string) => (value === '' ? null : Number(value))

  return (
    <section className="card">
      <div className="card__head">
        <span className="eyebrow">Metas diárias</span>
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Fechar' : 'Editar'}
        </button>
      </div>

      {open ? (
        <div className="grid-2">
          <label className="field">
            <span className="field__label">Kcal</span>
            <input
              className="input"
              type="number"
              defaultValue={plan.kcal_target ?? ''}
              onBlur={(event) => patch({ kcal_target: toNumber(event.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">Proteína (g)</span>
            <input
              className="input"
              type="number"
              defaultValue={plan.protein_target_g ?? ''}
              onBlur={(event) => patch({ protein_target_g: toNumber(event.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">Gordura (g)</span>
            <input
              className="input"
              type="number"
              defaultValue={plan.fat_target_g ?? ''}
              onBlur={(event) => patch({ fat_target_g: toNumber(event.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">Hidratos (g)</span>
            <input
              className="input"
              type="number"
              defaultValue={plan.carb_target_g ?? ''}
              onBlur={(event) => patch({ carb_target_g: toNumber(event.target.value) })}
            />
          </label>
        </div>
      ) : (
        <p className="subtitle">
          {plan.kcal_target
            ? `${plan.kcal_target} kcal · P ${plan.protein_target_g ?? '—'} · G ${
                plan.fat_target_g ?? '—'
              } · H ${plan.carb_target_g ?? '—'}`
            : 'Sem objectivo. Define as metas do aluno (separador Metas) e o plano assume-as.'}
        </p>
      )}

      {/* As metas mudaram depois de o plano ser escrito: um toque acerta-o. */}
      {targets?.kcal_target != null &&
        (fromTargets ? (
          <span className="field__hint">igual às metas em vigor do aluno</span>
        ) : (
          <button
            type="button"
            className="diet-edit__suggest"
            onClick={() =>
              patch({
                kcal_target: targets.kcal_target,
                protein_target_g: targets.protein_target_g,
                fat_target_g: targets.fat_target_g,
                carb_target_g: targets.carb_target_g,
              })
            }
          >
            metas do aluno: {int(targets.kcal_target)} kcal · usar
          </button>
        ))}
    </section>
  )
}

function ItemRow({ item, onChange }: { item: DietItem; onChange: () => void }) {
  return (
    <li className="diet-edit__item">
      <span className="diet-edit__item-name">{item.name}</span>
      <input
        className="diet-edit__qty"
        type="number"
        inputMode="decimal"
        min={0}
        defaultValue={item.quantity}
        onBlur={async (event) => {
          const quantity = Number(event.target.value)
          if (quantity === Number(item.quantity)) return

          // As macros guardadas são as da quantidade actual, por isso
          // reescalam-se a partir da proporção, não da base do alimento.
          const factor = Number(item.quantity) > 0 ? quantity / Number(item.quantity) : 0
          const round = (value: number) => Math.round(Number(value) * factor * 10) / 10

          unwrap(
            await supabase
              .from('diet_items')
              .update({
                quantity,
                protein_g: round(item.protein_g),
                fat_g: round(item.fat_g),
                carb_g: round(item.carb_g),
              })
              .eq('id', item.id)
              .select(),
          )
          onChange()
        }}
      />
      <span className="diet-edit__unit">{item.unit}</span>
      <span className="diet-edit__item-macros">
        P {num(item.protein_g, 0)} · G {num(item.fat_g, 0)} · H {num(item.carb_g, 0)}
      </span>
      <button
        type="button"
        className="diet-edit__remove"
        aria-label={`Remover ${item.name}`}
        onClick={async () => {
          unwrap(await supabase.from('diet_items').delete().eq('id', item.id).select())
          onChange()
        }}
      >
        ×
      </button>
    </li>
  )
}

function FoodPicker({
  mealId,
  sortOrder,
  usage,
  onClose,
  onAdded,
}: {
  mealId: string
  sortOrder: number
  /** Quantas vezes cada alimento já foi usado: os de sempre aparecem primeiro. */
  usage: Map<string, number>
  onClose: () => void
  onAdded: () => void
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 220)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data: results, loading } = useQuery(
    ['alimentos', debounced, usage.size],
    () => searchFoods(debounced, usage),
    { persist: false },
  )

  const preview = picked ? scaleFood(picked, Number(quantity) || 0) : null

  return (
    <div className="picker" role="dialog" aria-label="Base de alimentos">
      <button type="button" className="picker__scrim" onClick={onClose} aria-label="Fechar" />

      <div className="picker__sheet">
        <div className="picker__grip" />
        <div className="picker__head">
          <h2 className="picker__title">
            {picked ? picked.name : 'Base de alimentos'}
          </h2>
          <button type="button" className="btn btn--sm btn--quiet" onClick={onClose}>
            Fechar
          </button>
        </div>

        {picked ? (
          <div className="food-detail">
            <label className="field">
              <span className="field__label">Quantidade ({picked.unit})</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                value={quantity}
                autoFocus
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>

            {preview && (
              <p className="food-detail__macros">
                P {num(preview.protein_g, 1)} g · G {num(preview.fat_g, 1)} g · H{' '}
                {num(preview.carb_g, 1)} g ·{' '}
                <strong>
                  {int(
                    preview.protein_g * 4 + preview.fat_g * 9 + preview.carb_g * 4,
                  )}{' '}
                  kcal
                </strong>
              </p>
            )}

            <div className="row">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setPicked(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn--accent"
                onClick={async () => {
                  const macros = scaleFood(picked, Number(quantity) || 0)
                  unwrap(
                    await supabase
                      .from('diet_items')
                      .insert({
                        meal_id: mealId,
                        food_id: picked.id,
                        name: picked.name,
                        quantity: Number(quantity) || 0,
                        unit: picked.unit,
                        sort_order: sortOrder + count,
                        ...macros,
                      })
                      .select(),
                  )
                  setCount((value) => value + 1)
                  setPicked(null)
                  setQuantity('100')
                  onAdded()
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              className="input"
              value={term}
              placeholder="Procurar (ex.: frango, arroz, iogurte)"
              onChange={(event) => setTerm(event.target.value)}
              autoFocus
            />

            <ul className="picker__list">
              {loading && <li className="picker__empty">A procurar…</li>}
              {!loading && (results?.length ?? 0) === 0 && (
                <li className="picker__empty">
                  Nada encontrado{term ? ` para "${term}"` : ''}.
                </li>
              )}
              {(results ?? []).map((food, index) => (
                <li key={food.id} className="picker__item">
                  {/* O separador entre os que já se usaram e o resto da base. */}
                  {index === 0 && usage.has(food.id) && (
                    <span className="picker__section">Os que mais usas</span>
                  )}
                  {index > 0 &&
                    !usage.has(food.id) &&
                    usage.has(results![index - 1].id) && (
                      <span className="picker__section">Resto da base</span>
                    )}
                  <span className="picker__text">
                    <strong>{food.name}</strong>
                    <em>
                      {num(food.base_qty, 0)} {food.unit} · {int(food.kcal)} kcal · P{' '}
                      {num(food.protein_g, 1)}
                    </em>
                  </span>
                  <button
                    type="button"
                    className="picker__add"
                    onClick={() => {
                      setPicked(food)
                      setQuantity(String(food.base_qty))
                    }}
                    aria-label={`Escolher ${food.name}`}
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
