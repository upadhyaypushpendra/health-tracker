import type { MealType } from '../db/types'

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch', label: '☀️ Lunch' },
  { value: 'dinner', label: '🌙 Dinner' },
  { value: 'snack', label: '🍎 Snack' },
  { value: 'pre_workout', label: '💪 Pre-Workout' },
  { value: 'post_workout', label: '🔥 Post-Workout' },
]

export const MEAL_EMOJIS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎', pre_workout: '💪', post_workout: '🔥',
}
