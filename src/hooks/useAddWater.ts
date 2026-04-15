import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { db, getSettings } from '../db'
import type { WaterLog } from '../db/types'
import { useTodayWater } from './useTodayWater'
import { getTodayString } from '../utils/dateHelpers'

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
    if (waterLog) {
      await db.waterLogs.update(waterLog.id, { entries: [...waterLog.entries, entry] })
    } else {
      const log: WaterLog = {
        id: uuid(),
        date: getTodayString(),
        entries: [entry],
        goal: settings?.waterGoal ?? 3000,
      }
      await db.waterLogs.put(log)
    }
  }

  return addWater
}
