import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { healthSync } from '../services/healthSyncPlugin'
import { useAddWater } from './useAddWater'

export function useWidgetSync() {
  const addWater = useAddWater()
  const addWaterRef = useRef(addWater)
  addWaterRef.current = addWater

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const sync = async () => {
      if (document.visibilityState !== 'visible') return
      const pending = await healthSync.getPendingWidgetWater()
      if (pending > 0) {
        await addWaterRef.current(pending)
      }
    }

    document.addEventListener('visibilitychange', sync)
    sync()

    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
}
