import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db, getSettings } from '../db'
import type { WaterLog } from '../db/types'
import { useTodayWater } from './useTodayWater'
import { getTodayString } from '../utils/dateHelpers'
import { healthSync } from '../services/healthSyncPlugin'
import { syncNotificationStats } from '../services/notificationStats'
import { rescheduleWaterReminders } from './useNotifications'

/**
 * Returns an `addWater(amount)` callback that creates or updates
 * today's water log. Manages its own DB and settings subscriptions.
 */
export function useAddWater() {
  const waterLog = useTodayWater()
  const settings = useLiveQuery(() => getSettings())

  const addWater = async (amount: number) => {
    if (amount <= 0) return
    const entry = { amount, time: new Date().toISOString() }
    let updatedLog: WaterLog
    if (waterLog) {
      const newEntries = [...waterLog.entries, entry]
      await db.waterLogs.update(waterLog.id, { entries: newEntries })
      updatedLog = { ...waterLog, entries: newEntries }
    } else {
      updatedLog = {
        id: uuid(),
        date: getTodayString(),
        entries: [entry],
        goal: settings?.waterGoal ?? 3000,
      }
      await db.waterLogs.put(updatedLog)
    }
    // Sync to Health Connect
    healthSync.writeHydrationRecord(entry.amount, entry.time)
    syncNotificationStats()
    rescheduleWaterReminders()
  }

  return addWater
}
