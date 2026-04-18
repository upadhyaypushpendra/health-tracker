import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAddWater } from '../../hooks/useAddWater'
import { useTodayWater } from '../../hooks/useTodayWater'
import { getSettings } from '../../db'
import { formatWater, pct, totalWater } from '../../utils/calculations'
import { hapticLight } from '../../utils/haptics'

const WATER_PRESETS = [
  { label: '½ glass', amount: 125 },
  { label: '1 glass', amount: 250 },
  { label: '2 glasses', amount: 500 },
]

// Generates a wave-topped filled path
function makeWavePath(surfaceY: number, phase: number, W: number, bottom: number, amp = 3.5) {
  const period = W / 2
  const startX = -(phase % 1) * period - period
  const endX = W + period * 2
  let d = `M ${startX} ${surfaceY}`
  for (let x = startX; x < endX; x += period) {
    d += ` Q ${x + period / 4} ${surfaceY - amp} ${x + period / 2} ${surfaceY}`
    d += ` Q ${x + (3 * period) / 4} ${surfaceY + amp} ${x + period} ${surfaceY}`
  }
  d += ` L ${endX} ${bottom + 20} L ${startX} ${bottom + 20} Z`
  return d
}

function WaterBottle({ percentage }: { percentage: number }) {
  const displayedRef = useRef(percentage)
  const [displayed, setDisplayed] = useState(percentage)
  const [wavePhase, setWavePhase] = useState(0)
  const rafRef = useRef<number>()
  const phaseRef = useRef(0)

  useEffect(() => {
    const tick = () => {
      const diff = percentage - displayedRef.current
      if (Math.abs(diff) < 0.05) {
        displayedRef.current = percentage
        setDisplayed(percentage)
        return
      }
      displayedRef.current += diff * 0.1
      phaseRef.current += 0.018
      setDisplayed(displayedRef.current)
      setWavePhase(phaseRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [percentage])

  const clamped = Math.min(100, Math.max(0, displayed))
  const isAnimating = Math.abs(clamped - percentage) > 0.1

  // Bottle body: x=144–304, y=128–480 (rectangular interior)
  const fillTop = 128
  const fillBottom = 480
  const fillRange = fillBottom - fillTop
  const W = 512

  const surfaceY = fillBottom - (fillRange * clamped) / 100

  const waterPath = clamped > 0
    ? (isAnimating
        ? makeWavePath(surfaceY, wavePhase, W, fillBottom)
        : `M 0 ${surfaceY} L ${W} ${surfaceY} L ${W} ${fillBottom} L 0 ${fillBottom} Z`)
    : null

  const fillColor = '#0a61d4'
  const glowOpacity = 0.15

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <div
        className="absolute inset-0 rounded-full blur-xl transition-all duration-700 pointer-events-none"
        style={{ background: `rgba(96,165,250,${glowOpacity})` }}
      />
      <svg viewBox="0 0 512 512" width="150" height="250" style={{ overflow: 'visible' }}>
        <defs>
          {/* Rectangular inner body of this bottle SVG */}
          <clipPath id="water-bottle-clip">
            <rect x="144" y="128" width="160" height="352" />
          </clipPath>
        </defs>

        {/* Bottle base — renders first so animated fill layers on top */}
        <g fill="#60a5fa" opacity={0.9}>
          <path d="M400,104c0-44.113-35.891-80-80-80h-40v-8c0-8.836-7.164-16-16-16h-80
            c-8.836,0-16,7.164-16,16v48c0,8.836,7.164,16,16,16h8v16h-64c-8.836,0-16,7.164-16,16v81.578
            c0,14.398,7.148,27.758,19.133,35.738c3.047,2.031,4.867,5.434,4.867,9.105v35.156
            c0,3.672-1.82,7.074-4.867,9.105c-11.984,7.98-19.133,21.34-19.133,35.738V496
            c0,8.836,7.164,16,16,16h192c8.836,0,16-7.164,16-16V318.422
            c0-14.398-7.148-27.758-19.133-35.738c-3.047-2.031-4.867-5.434-4.867-9.105v-35.156
            c0-3.672,1.82-7.074,4.867-9.105c11.984-7.98,19.133-21.34,19.133-35.738v-11.19
            C372.469,174.955,400,142.634,400,104z
            M200,32h48v16h-48V32z
            M336,149.2V112c0-8.836-7.164-16-16-16h-64V80h8c8.836,0,16-7.164,16-16v-8h40
            c26.469,0,48,21.531,48,48C368,124.852,354.613,142.589,336,149.2z"/>
        </g>

        {/* Animated water fill on top of base, clipped to inner body */}
        {waterPath && (
          <g clipPath="url(#water-bottle-clip)">
            <path d={waterPath} fill={fillColor} opacity={1} />
          </g>
        )}
      </svg>
    </div>
  )
}

export default function WaterSection() {
  const todayWater = useTodayWater()
  const settings = useLiveQuery(() => getSettings())
  const addWater = useAddWater()

  const waterTotal = totalWater(todayWater?.entries ?? [])
  const waterGoal = settings?.waterGoal ?? todayWater?.goal ?? 3000
  const waterPct = pct(waterTotal, waterGoal)

  return (
    <div className="mb-5 rounded-2xl bg-gradient-to-b from-[#0A1628] to-[#0D1520] border border-blue-900/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-blue-400/70 uppercase tracking-wider font-semibold">Hydration</p>
          <p className="text-lg font-black text-white mt-0.5">
            {formatWater(waterTotal)}
            <span className="text-sm font-medium text-blue-400/60 ml-1.5">/ {formatWater(waterGoal)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-300">{Math.round(waterPct)}%</p>
          <p className="text-[16px] text-blue-400/50 mt-0.5">
            {waterPct >= 100 ? 'Goal reached!' : `${formatWater(waterGoal - waterTotal)} left`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <WaterBottle percentage={waterPct} />
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {WATER_PRESETS.map(({ label, amount }) => (
            <button
              key={label}
              onClick={() => { hapticLight(); addWater(amount) }}
              className="flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 active:scale-[0.97] rounded-xl transition-all border border-blue-500/10"
            >
              <span className="text-sm font-bold text-blue-300">+{label}</span>
              <span className="text-xs text-blue-400/60 font-medium">{amount} ml</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
