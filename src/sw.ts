/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Inject precache manifest by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST)

// ─── Water reminder state ────────────────────────────────────────────────────

let waterTimeoutId: ReturnType<typeof setTimeout> | null = null
let waterIntervalMs = 0

function scheduleNextWaterReminder() {
  if (waterTimeoutId !== null) clearTimeout(waterTimeoutId)

  waterTimeoutId = setTimeout(async () => {
    await self.registration.showNotification('💧 Time to hydrate!', {
      body: 'Drink a glass of water to stay on track with your daily goal.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'water-reminder',
      actions: [{ action: 'drank', title: '✅ Drank 1 glass (250ml)' }],
    } as NotificationOptions)
    // Chain next reminder
    scheduleNextWaterReminder()
  }, waterIntervalMs)
}

// ─── Add water entry directly to IndexedDB ──────────────────────────────────

function addWaterEntry(amountMl: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0]
    const openReq = indexedDB.open('BodySyncDB')

    openReq.onerror = () => reject(openReq.error)
    openReq.onsuccess = () => {
      const db = openReq.result
      const tx = db.transaction('waterLogs', 'readwrite')
      const store = tx.objectStore('waterLogs')
      const idx = store.index('date')
      const getReq = idx.get(today)

      getReq.onsuccess = () => {
        const newEntry = { amount: amountMl, time: new Date().toISOString() }
        if (getReq.result) {
          const log = getReq.result
          log.entries = [...(log.entries ?? []), newEntry]
          store.put(log)
        } else {
          store.put({
            id: crypto.randomUUID(),
            date: today,
            entries: [newEntry],
            goal: 3000,
          })
        }
      }

      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })
}

// ─── Notification click handler ──────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  if (event.action === 'drank') {
    event.waitUntil(addWaterEntry(250))
  } else {
    // Default click: focus or open the app
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          if (clients.length > 0) return clients[0].focus()
          return self.clients.openWindow('/')
        })
    )
  }
})

// ─── Message handler (from the app page) ────────────────────────────────────

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, intervalMs } = event.data ?? {}

  if (type === 'START_WATER_REMINDER' && intervalMs > 0) {
    waterIntervalMs = intervalMs
    scheduleNextWaterReminder()
  } else if (type === 'STOP_WATER_REMINDER') {
    if (waterTimeoutId !== null) {
      clearTimeout(waterTimeoutId)
      waterTimeoutId = null
    }
    waterIntervalMs = 0
  }
})

// ─── Activate: take control immediately ─────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
