import { useCallback } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db, getSettings } from '../db'
import { getTodayString } from '../utils/dateHelpers'

const WATER_ID_BASE = 2000   // 2000–2099
const WORKOUT_ID_BASE = 3000 // 3000–3006 (one per day, 7-day lookahead)

// ─── Smart Water Reminders ────────────────────────────────────────────────────
// Schedules water reminders for the rest of today based on current intake.
// Interval is derived from how many glasses remain and how much time is left
// in the active window (08:00–22:00). Clamps to 20–90 min.
// Call this whenever intake changes or the app comes to foreground.

export async function rescheduleWaterReminders(): Promise<void> {
  // Cancel ALL pending notifications to clear any legacy IDs from older builds
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
  }

  const settings = await getSettings()
  if (!settings.notificationsEnabled) return

  const today = getTodayString()
  const log = await db.waterLogs.where('date').equals(today).first()
  const intakeMl = log?.entries.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const goalMl = settings.waterGoal

  if (intakeMl >= goalMl) return

  const now = new Date()
  const todayBase = now.toDateString()
  const windowStart = new Date(`${todayBase} 08:00:00`)
  const windowEnd = new Date(`${todayBase} 22:00:00`)

  if (now >= windowEnd) return

  const effectiveStart = now > windowStart ? now : windowStart
  const remainingMs = windowEnd.getTime() - effectiveStart.getTime()
  const remainingMl = goalMl - intakeMl
  const glassSize = 250
  const remainingGlasses = Math.ceil(remainingMl / glassSize)

  if (remainingGlasses <= 0) return

  const intervalMs = Math.max(
    20 * 60 * 1000,
    Math.min(90 * 60 * 1000, remainingMs / remainingGlasses),
  )

  const totalGlasses = Math.ceil(goalMl / glassSize)
  let glassesDone = Math.floor(intakeMl / glassSize)
  let nextTime = new Date(effectiveStart.getTime() + intervalMs)
  let id = WATER_ID_BASE
  const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []

  while (nextTime < windowEnd && id < WATER_ID_BASE + 100) {
    glassesDone++
    const glassesLeft = totalGlasses - glassesDone
    const body = glassesLeft <= 0
      ? `One more — you're almost at your ${goalMl / 1000}L goal!`
      : `${glassesDone}/${totalGlasses} glasses done — ${glassesLeft} to go.`

    notifications.push({
      id: id++,
      title: '💧 Time to hydrate!',
      body,
      schedule: { at: new Date(nextTime), allowWhileIdle: true },
      actionTypeId: 'WATER_ACTIONS',
      extra: null,
    })

    nextTime = new Date(nextTime.getTime() + intervalMs)
    if (glassesDone >= totalGlasses) break
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications })
  }
}

// ─── Plan-aware Workout Reminders ─────────────────────────────────────────────
// Schedules one notification per upcoming workout day (7-day lookahead).
// Skips rest days, days with no exercises, and days where the workout is
// already completed. Re-schedule whenever the plan or reminder time changes.

export async function rescheduleWorkoutReminders(): Promise<void> {
  const cancelIds = Array.from({ length: 7 }, (_, i) => ({ id: WORKOUT_ID_BASE + i }))
  await LocalNotifications.cancel({ notifications: cancelIds })

  const settings = await getSettings()
  if (!settings.notificationsEnabled || !settings.workoutReminderTime || !settings.activePlanId) return

  const plan = await db.plans.get(settings.activePlanId)
  if (!plan) return

  const [hours, minutes] = settings.workoutReminderTime.split(':').map(Number)
  const now = new Date()
  const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = []

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const fireAt = new Date(now)
    fireAt.setDate(now.getDate() + dayOffset)
    fireAt.setHours(hours, minutes, 0, 0)

    if (fireAt <= now) continue

    const dow = fireAt.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    const dayPlan = plan.weekTemplate.find(d => d.dayOfWeek === dow)
    if (!dayPlan || dayPlan.isRest || dayPlan.exercises.length === 0) continue

    const dateStr = fireAt.toISOString().split('T')[0]
    const workoutLog = await db.workoutLogs.where('date').equals(dateStr).first()
    if (workoutLog?.completed) continue

    const preview = dayPlan.exercises.slice(0, 2).map(e => e.name).join(' & ')
    const body = preview
      ? `${preview} — time to get it done.`
      : "Your workout is ready. Let's go!"

    notifications.push({
      id: WORKOUT_ID_BASE + dayOffset,
      title: '💪 Workout time!',
      body,
      schedule: { at: fireAt, allowWhileIdle: true },
      actionTypeId: '',
      extra: null,
    })
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications })
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  }, [])

  const checkPermission = useCallback(async (): Promise<boolean> => {
    const result = await LocalNotifications.checkPermissions()
    return result.display === 'granted'
  }, [])

  const initReminders = useCallback(async () => {
    await Promise.all([rescheduleWaterReminders(), rescheduleWorkoutReminders()])
  }, [])

  const stopAllReminders = useCallback(async () => {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    }
  }, [])

  return {
    requestPermission,
    checkPermission,
    initReminders,
    stopAllReminders,
  }
}
