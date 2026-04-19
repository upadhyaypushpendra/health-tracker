import Dexie, { type Table } from 'dexie'
import type { Plan, WorkoutLog, WaterLog, MealLog, BodyMetric, Exercise, UserSettings, CustomFood } from './types'

interface MigrationRecord {
  id: string
  appliedAt: string
}

class BodySyncDB extends Dexie {
  plans!: Table<Plan, string>
  workoutLogs!: Table<WorkoutLog, string>
  waterLogs!: Table<WaterLog, string>
  mealLogs!: Table<MealLog, string>
  bodyMetrics!: Table<BodyMetric, string>
  exercises!: Table<Exercise, string>
  settings!: Table<UserSettings, string>
  customFoods!: Table<CustomFood, string>
  migrations!: Table<MigrationRecord, string>

  constructor() {
    super('BodySyncDB')

    this.version(1).stores({
      plans: 'id, name, isActive, createdAt',
      workoutLogs: 'id, date, planId, completed',
      waterLogs: 'id, date',
      mealLogs: 'id, date, mealType, createdAt',
      bodyMetrics: 'id, date',
      exercises: 'id, name, muscleGroup, isCustom',
      settings: 'key',
    })

    this.version(2).stores({
      plans: 'id, name, isActive, createdAt',
      workoutLogs: 'id, date, planId, completed',
      waterLogs: 'id, date',
      mealLogs: 'id, date, mealType, createdAt',
      bodyMetrics: 'id, date',
      exercises: 'id, name, muscleGroup, isCustom',
      settings: 'key',
      customFoods: 'id, name, createdAt',
    })

    this.version(3).stores({
      plans: 'id, name, isActive, createdAt',
      workoutLogs: 'id, date, planId, completed',
      waterLogs: 'id, date',
      mealLogs: 'id, date, mealType, createdAt',
      bodyMetrics: 'id, date',
      exercises: 'id, name, muscleGroup, isCustom',
      settings: 'key',
      customFoods: 'id, name, createdAt',
      migrations: 'id',
    })
  }
}

export const db = new BodySyncDB()

// ─── Settings helpers ────────────────────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const s = await db.settings.get('user')
  if (s) return s
  const defaults: UserSettings = {
    key: 'user',
    name: '',
    gender: null,
    currentWeight: null,
    height: null,
    waterGoal: 3000,
    weightUnit: 'kg',
    notificationsEnabled: false,
    workoutReminderTime: null,
    waterReminderInterval: null,
    mealReminderTimes: [],
    onboardingCompleted: false,
    activePlanId: null,
    createdAt: new Date().toISOString(),
  }
  await db.settings.put(defaults)
  return defaults
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch })
}
