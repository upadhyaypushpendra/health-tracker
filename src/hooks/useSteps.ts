import { Health } from '@capgo/capacitor-health'
import { useEffect, useState } from 'react'
import { getSettings } from '../db'
import { healthSync } from '../services/healthSyncPlugin'

export function useSteps() {
  const [steps, setSteps] = useState<number | null>(null)
  const [available, setAvailable] = useState(false)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const { available: isAvailable } = await Health.isAvailable()
        setAvailable(isAvailable)

        if (!isAvailable) {
          // Fall back to hardware step counter sensor
          const permission = await healthSync.checkActivityPermission()
          if (permission !== 'granted') return
          setConnected(true)
          await fetchSensorSteps()
          return
        }

        const status = await Health.checkAuthorization({ read: ['steps'] })
        if (status.readAuthorized.includes('steps')) {
          setConnected(true)
          await fetchSteps()
        }
      } catch {
        // health data is optional
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  async function fetchSteps() {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const result = await Health.queryAggregated({
      dataType: 'steps',
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    })
    const stepCount = result.samples[0]?.value ?? 0
    setSteps(stepCount)

    const settings = await getSettings()
    await healthSync.syncStepData(stepCount, settings.stepGoal)
  }

  async function fetchSensorSteps() {
    const sensorSteps = await healthSync.getStepsFromSensor()
    if (sensorSteps !== null) {
      setSteps(sensorSteps)
      const settings = await getSettings()
      await healthSync.syncStepData(sensorSteps, settings.stepGoal)
    }
  }

  async function connect() {
    try {
      if (available) {
        await Health.requestAuthorization({ read: ['steps'] })
        setConnected(true)
        await fetchSteps()
      } else {
        const permission = await healthSync.requestActivityPermission()
        if (permission !== 'granted') return
        setConnected(true)
        await fetchSensorSteps()
      }
    } catch {
      // user denied — stay on connect screen
    }
  }

  return { steps, available, connected, loading, connect }
}
