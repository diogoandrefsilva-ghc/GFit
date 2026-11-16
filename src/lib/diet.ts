import { EMPTY_MACROS, addMacros, macrosOf, type Macros } from './calc'
import type { DietItem, DietMeal, MealLog } from './database.types'

/**
 * Uma refeição do plano com as opções que tem. A primeira é a do plano — a
 * que soma ao total do dia —, as outras são as alternativas que o treinador
 * deixou.
 */
export interface MealSlot {
  meal: DietMeal
  options: DietMeal[]
}

export function mealSlots(meals: DietMeal[]): MealSlot[] {
  return meals
    .filter((meal) => !meal.alternative_to)
    .map((meal) => ({
      meal,
      options: [meal, ...meals.filter((other) => other.alternative_to === meal.id)],
    }))
}

/** O total do plano: uma opção por refeição, a primeira. */
export function planMacros(
  slots: MealSlot[],
  itemsByMeal: Map<string, DietItem[]>,
): Macros {
  return slots.reduce<Macros>(
    (sum, slot) => addMacros(sum, macrosOf(itemsByMeal.get(slot.meal.id) ?? [])),
    EMPTY_MACROS,
  )
}

/** A opção de cada refeição que ficou marcada num dia, se alguma. */
export function eatenOption(slot: MealSlot, logs: MealLog[], date: string): DietMeal | null {
  return (
    slot.options.find((option) =>
      logs.some((log) => log.log_date === date && log.meal_id === option.id),
    ) ?? null
  )
}

/** O que se comeu num dia, somando as opções marcadas. */
export function eatenMacros(
  slots: MealSlot[],
  itemsByMeal: Map<string, DietItem[]>,
  logs: MealLog[],
  date: string,
): Macros {
  return slots.reduce<Macros>((sum, slot) => {
    const eaten = eatenOption(slot, logs, date)
    return eaten ? addMacros(sum, macrosOf(itemsByMeal.get(eaten.id) ?? [])) : sum
  }, EMPTY_MACROS)
}

/**
 * A aderência à dieta num intervalo de dias: das refeições do plano, quantas
 * por cento ficaram marcadas. Nulo quando não há plano ou nada foi marcado —
 * quem nunca marcou não tem 0%, tem "não sei".
 */
export function mealAdherence(
  slots: MealSlot[],
  logs: MealLog[],
  dates: string[],
): number | null {
  if (slots.length === 0 || dates.length === 0 || logs.length === 0) return null
  let eaten = 0
  for (const date of dates) {
    for (const slot of slots) if (eatenOption(slot, logs, date)) eaten++
  }
  return Math.round((eaten / (slots.length * dates.length)) * 100)
}
