import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import BottomNav from './BottomNav'
import { getSettings } from '../../db'
import { useNotifications } from '../../hooks/useNotifications'

export default function AppShell() {
  const location = useLocation()
  const isOnboarding = location.pathname === '/onboarding'
  const settings = useLiveQuery(() => getSettings())
  const { startWaterReminders, stopWaterReminders } = useNotifications()

  useEffect(() => {
    if (settings?.notificationsEnabled && settings.waterReminderInterval) {
      startWaterReminders(settings.waterReminderInterval)
    } else {
      stopWaterReminders()
    }
    // No cleanup needed — the SW manages its own lifecycle independently
  }, [settings?.notificationsEnabled, settings?.waterReminderInterval, startWaterReminders, stopWaterReminders])

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      {!isOnboarding && <BottomNav />}
    </div>
  )
}
