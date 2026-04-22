import { createContext, useContext, useEffect, useState } from 'react'
import { playTimerSound } from '../utils/sound'

interface TimerContextValue {
  duration: number
  timeLeft: number
  isRunning: boolean
  isVisible: boolean
  start: (duration?: number) => void
  pause: () => void
  reset: () => void
  setDuration: (d: number) => void
  show: () => void
  hide: () => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [duration, setDurationState] = useState(60)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isRunning, setIsRunning] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0 && isRunning) {
        setIsRunning(false)
        setIsVisible(false)
        playTimerSound()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      }
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [isRunning, timeLeft])

  const start = (d?: number) => {
    if (d !== undefined) {
      setDurationState(d)
      setTimeLeft(d)
    }
    setIsRunning(true)
    setIsVisible(true)
  }

  const pause = () => setIsRunning(false)

  const reset = () => {
    setIsRunning(false)
    setTimeLeft(duration)
  }

  const setDuration = (d: number) => {
    setDurationState(d)
    setTimeLeft(d)
    setIsRunning(false)
  }

  return (
    <TimerContext.Provider value={{
      duration, timeLeft, isRunning, isVisible,
      start, pause, reset, setDuration,
      show: () => setIsVisible(true),
      hide: () => setIsVisible(false),
    }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within TimerProvider')
  return ctx
}
