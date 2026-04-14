import { useCallback, useEffect, useState } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '../utils/platform'

// ─── Notification IDs (stable, so we can cancel by ID) ───────────────────────

const WATER_NOTIFICATION_ID = 1001
const WORKOUT_NOTIFICATION_ID = 1002

// ─── SW messaging helpers (web path) ────────────────────────────────────────

async function postToSW(message: Record<string, unknown>) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sw = reg.active
  if (!sw) return

  if (sw.state === 'activated') {
    sw.postMessage(message)
    return
  }

  await new Promise<void>((resolve) => {
    sw.addEventListener('statechange', function onStateChange() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', onStateChange)
        resolve()
      }
    })
  })
  sw.postMessage(message)
}

// ─── Page-level fallback (web path, used when SW is not available) ────────────
let pageIntervalId: ReturnType<typeof setInterval> | null = null

function firePageNotification() {
  if (Notification.permission !== 'granted') return
  new Notification('💧 Time to hydrate!', {
    body: 'Drink a glass of water to stay on track with your daily goal.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [nativePermissionGranted, setNativePermissionGranted] = useState(false)

  useEffect(() => {
    if (!isNative) return
    LocalNotifications.checkPermissions().then((result) => {
      setNativePermissionGranted(result.display === 'granted')
    })
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      const result = await LocalNotifications.requestPermissions()
      const granted = result.display === 'granted'
      setNativePermissionGranted(granted)
      return granted
    }
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  const scheduleWorkoutReminder = useCallback(async (time: string | null) => {
    if (isNative) {
      // Cancel any existing workout reminder first
      await LocalNotifications.cancel({ notifications: [{ id: WORKOUT_NOTIFICATION_ID }] })
      if (!time) return

      const [hours, minutes] = time.split(':').map(Number)
      await LocalNotifications.schedule({
        notifications: [{
          id: WORKOUT_NOTIFICATION_ID,
          title: 'Time to work out!',
          body: 'Your scheduled workout is ready. Open Body Sync to get started.',
          schedule: {
            on: { hour: hours, minute: minutes },
            allowWhileIdle: true,
          },
          actionTypeId: '',
          extra: null,
        }],
      })
    }
    // Web: workout reminders via SW push not yet supported (requires push server)
  }, [])

  const cancelWorkoutReminder = useCallback(async () => {
    if (isNative) {
      await LocalNotifications.cancel({ notifications: [{ id: WORKOUT_NOTIFICATION_ID }] })
    }
  }, [])

  const startWaterReminders = useCallback(async (intervalMinutes: number) => {
    if (isNative) {
      // Cancel any previous water reminder
      await LocalNotifications.cancel({ notifications: [{ id: WATER_NOTIFICATION_ID }] })
      await LocalNotifications.schedule({
        notifications: [{
          id: WATER_NOTIFICATION_ID,
          title: '💧 Time to hydrate!',
          body: 'Drink a glass of water to stay on track with your daily goal.',
          schedule: {
            every: 'minute',
            count: intervalMinutes,
            allowWhileIdle: true,
          },
          actionTypeId: 'WATER_ACTIONS',
          extra: null,
        }],
      })
      return
    }

    // Web path
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const intervalMs = intervalMinutes * 60 * 1000
    if ('serviceWorker' in navigator) {
      await postToSW({ type: 'START_WATER_REMINDER', intervalMs })
      if (pageIntervalId !== null) { clearInterval(pageIntervalId); pageIntervalId = null }
    } else {
      if (pageIntervalId !== null) clearInterval(pageIntervalId)
      pageIntervalId = setInterval(firePageNotification, intervalMs)
    }
  }, [])

  const stopWaterReminders = useCallback(async () => {
    if (isNative) {
      await LocalNotifications.cancel({ notifications: [{ id: WATER_NOTIFICATION_ID }] })
      return
    }

    // Web path
    if ('serviceWorker' in navigator) {
      await postToSW({ type: 'STOP_WATER_REMINDER' })
    }
    if (pageIntervalId !== null) {
      clearInterval(pageIntervalId)
      pageIntervalId = null
    }
  }, [])

  const scheduleReminder = useCallback((title: string, body: string, delayMs: number) => {
    if (isNative) {
      LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title,
          body,
          schedule: { at: new Date(Date.now() + delayMs), allowWhileIdle: true },
          actionTypeId: '',
          extra: null,
        }],
      })
      return
    }
    if (Notification.permission !== 'granted') return
    setTimeout(() => {
      new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' })
    }, delayMs)
  }, [])

  const isSupported = isNative || ('Notification' in window)
  const isGranted = isNative
    ? nativePermissionGranted
    : ('Notification' in window && Notification.permission === 'granted')

  return {
    requestPermission,
    scheduleReminder,
    scheduleWorkoutReminder,
    cancelWorkoutReminder,
    startWaterReminders,
    stopWaterReminders,
    isSupported,
    isGranted,
  }
}
