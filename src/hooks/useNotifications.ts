import { useCallback } from 'react'

// ─── SW messaging helpers ────────────────────────────────────────────────────

async function postToSW(message: Record<string, unknown>) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  reg.active?.postMessage(message)
}

// ─── Page-level fallback (used when SW is not available) ────────────────────
// Module-level so it survives re-renders
let pageIntervalId: ReturnType<typeof setInterval> | null = null

function firePageNotification() {
  if (Notification.permission !== 'granted') return
  new Notification('💧 Time to hydrate!', {
    body: 'Drink a glass of water to stay on track with your daily goal.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
}

export function useNotifications() {
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  const scheduleReminder = useCallback((title: string, body: string, delayMs: number) => {
    if (Notification.permission !== 'granted') return
    setTimeout(() => {
      new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' })
    }, delayMs)
  }, [])

  const startWaterReminders = useCallback(async (intervalMinutes: number) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const intervalMs = intervalMinutes * 60 * 1000

    if ('serviceWorker' in navigator) {
      // Preferred: let the SW handle it so it works in background/closed tab
      await postToSW({ type: 'START_WATER_REMINDER', intervalMs })
      // Clear any page-level fallback
      if (pageIntervalId !== null) { clearInterval(pageIntervalId); pageIntervalId = null }
    } else {
      // Fallback: page-level interval (only works while tab is open)
      if (pageIntervalId !== null) clearInterval(pageIntervalId)
      pageIntervalId = setInterval(firePageNotification, intervalMs)
    }
  }, [])

  const stopWaterReminders = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      await postToSW({ type: 'STOP_WATER_REMINDER' })
    }
    if (pageIntervalId !== null) {
      clearInterval(pageIntervalId)
      pageIntervalId = null
    }
  }, [])

  const isSupported = 'Notification' in window
  const isGranted = isSupported && Notification.permission === 'granted'

  return { requestPermission, scheduleReminder, startWaterReminders, stopWaterReminders, isSupported, isGranted }
}
