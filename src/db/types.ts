// ─── Exercise Library ────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'full_body'

export type ExerciseUnit = 'kg' | 'lbs' | 'bodyweight' | 'minutes' | 'meters'

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  defaultSets: number
  defaultReps: number
  defaultWeight: number
  unit: ExerciseUnit
  isCustom: boolean
  description?: string
}

// ─── Plan Types ──────────────────────────────────────────────────────────────

export interface SetLog {
  setNumber: number
  targetReps: number
  actualReps: number | null
  targetWeight: number
  actualWeight: number | null
  completed: boolean
}

export interface PlannedExercise {
  exerciseId: string
  name: string
  sets: number
  reps: number
  weight: number
  unit: ExerciseUnit
  restSeconds: number
}

export interface DayPlan {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday
  isRest: boolean
  label?: string
  exercises: PlannedExercise[]
}

export interface Plan {
  id: string
  name: string
  description?: string
  weekTemplate: DayPlan[]
  calorieGoal: number      // kcal/day target for this plan
  proteinGoal: number      // grams/day
  carbsGoal: number        // grams/day
  weightGoal: number | null // target body weight in kg
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Workout Log ─────────────────────────────────────────────────────────────

export interface ExerciseLog {
  exerciseId: string
  name: string
  sets: SetLog[]
  completed: boolean
  notes?: string
}

export interface WorkoutLog {
  id: string
  date: string // ISO date 'YYYY-MM-DD'
  planId: string | null
  dayLabel?: string
  exercises: ExerciseLog[]
  completed: boolean
  startedAt?: string
  completedAt?: string
  notes?: string
}

// ─── Water Log ───────────────────────────────────────────────────────────────

export interface WaterEntry {
  amount: number // ml
  time: string // ISO timestamp
}

export interface WaterLog {
  id: string
  date: string
  entries: WaterEntry[]
  goal: number // ml
}

// ─── Meal Log ────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'

export interface MealLog {
  id: string
  date: string
  mealType: MealType
  name: string
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
  createdAt: string
}

// ─── Custom Food ─────────────────────────────────────────────────────────────

export interface CustomFood {
  id: string
  name: string
  calories: number // per entry (absolute, not per 100g)
  protein: number
  carbs: number
  fat: number
  createdAt: string
}

// ─── Body Metrics ─────────────────────────────────────────────────────────────

export interface BodyMetric {
  id: string
  date: string
  weight: number | null // kg
  height: number | null // cm (stored each time for BMI calc)
  bodyFat: number | null // percentage
  bmi: number | null // auto-calculated
  notes?: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface UserSettings {
  key: 'user'
  name: string
  gender: 'male' | 'female' | 'other' | null
  currentWeight: number | null // kg
  height: number | null        // cm
  waterGoal: number            // ml, default 3000
  weightUnit: 'kg' | 'lbs'
  notificationsEnabled: boolean
  workoutReminderTime: string | null  // 'HH:MM'
  waterReminderInterval: number | null // minutes
  mealReminderTimes: string[]          // ['HH:MM', ...]
  onboardingCompleted: boolean
  activePlanId: string | null
  createdAt: string
  geminiApiKey?: string
}
