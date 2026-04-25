import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { LocalNotifications } from '@capacitor/local-notifications'
import BottomNav from './BottomNav'
import { db, getSettings } from '../../db'
import { useNotifications } from '../../hooks/useNotifications'
import { healthSync } from '../../services/healthSyncPlugin'
import { syncNotificationStats } from '../../services/notificationStats'
import { getTodayString } from '../../utils/dateHelpers'

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isOnboarding = location.pathname === '/onboarding'
  const settings = useLiveQuery(() => getSettings())
  const { initReminders, stopAllReminders } = useNotifications()

  useEffect(() => {
    if (settings === undefined) return
    if (settings.notificationsEnabled) {
      initReminders()
    } else {
      stopAllReminders()
    }
  }, [settings?.notificationsEnabled, settings?.workoutReminderTime, settings?.activePlanId])

  // Start persistent health notification and reconcile pending water from notification actions
  useEffect(() => {
    if (settings === undefined) return

    async function init() {
      // Request POST_NOTIFICATIONS permission (Android 13+) before starting the service.
      // Without it, startForeground() silently fails and Android kills the service.
      const permStatus = await LocalNotifications.checkPermissions()
      if (permStatus.display === 'prompt' || permStatus.display === 'prompt-with-rationale') {
        await LocalNotifications.requestPermissions()
      }

      // Reconcile water added from the notification while the app was killed
      const pendingMl = await healthSync.getPendingWaterAdd()
      if (pendingMl > 0) {
        const today = getTodayString()
        const existing = await db.waterLogs.where('date').equals(today).first()
        const entry = { amount: pendingMl, time: new Date().toISOString() }
        if (existing) {
          await db.waterLogs.update(existing.id, { entries: [...existing.entries, entry] })
        } else {
          await db.waterLogs.put({ id: uuid(), date: today, entries: [entry], goal: settings?.waterGoal ?? 3000 })
        }
      }
      syncNotificationStats()
    }

    init()
  }, [settings?.activePlanId, settings?.waterGoal, settings?.stepGoal])

  // Handle "Log Meal" deep link from notification
  useEffect(() => {
    async function checkIntent() {
      const action = await healthSync.getIntentAction()
      if (action === 'log_meal') navigate('/nutrition', { state: { openLogMeal: true } })
    }

    checkIntent()

    const onVisible = () => { if (document.visibilityState === 'visible') checkIntent() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      {!isOnboarding && <BottomNav />}
    </div>
  )
}
