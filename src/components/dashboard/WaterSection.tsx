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

// The provided water bottle SVG path (viewBox 0 0 462.9 462.9, translated 0 -540.36)
// We re-express the paths in a 0-based viewBox by adding 540.36 to all Y values
// The bottle body occupies roughly Y=555..988 in original coords => 14.64..447.64 in our 0-based space
// We use the original viewBox with the g transform intact and overlay fill behind the outline

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

  // The bottle body in the SVG (original coords with transform translate(0 -540.36)):
  // Top of fill area (inside bottle): approx Y=587 in original → 46.64 in 0-based
  // Bottom of fill area: approx Y=988 in original → 447.64 in 0-based
  // ViewBox height = 462.9 (original), we'll use that directly with the group transform

  // Fill area in original viewBox coords (before the translate group):
  // The bottle contents span from about y=621 (top of inner body) to y=988 (bottom)
  // Within the 462.9 height, and the group translate(0,-540.36) means rendered y = original_y - 540.36
  // So fill top in rendered space ≈ 621 - 540.36 = 80.64
  // Fill bottom in rendered space ≈ 988 - 540.36 = 447.64
  const fillTop = 80
  const fillBottom = 450
  const fillRange = fillBottom - fillTop
  const W = 462.9

  const surfaceY = fillBottom - (fillRange * clamped) / 100

  const waterPath = clamped > 0
    ? (isAnimating
        ? makeWavePath(surfaceY, wavePhase, W, fillBottom)
        : `M 0 ${surfaceY} L ${W} ${surfaceY} L ${W} ${fillBottom + 20} L 0 ${fillBottom + 20} Z`)
    : null

  // Water color: pale → deep blue as level rises
  const r = Math.round(96 - clamped * 0.4)
  const g = Math.round(165 - clamped * 1.0)
  const fillColor = `rgb(${r},${g},255)`
  const glowOpacity = clamped * 0.003

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl transition-all duration-700 pointer-events-none"
        style={{ background: `rgba(96,165,250,${glowOpacity})` }}
      />
      <svg
        viewBox="0 0 462.9 462.9"
        width="150"
        height="250"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Clip to bottle inner hollow — simple rect covering the fillable body */}
          <clipPath id="water-bottle-clip">
            <rect x="155" y="80" width="153" height="375" rx="12" />
          </clipPath>
        </defs>

        {/* Water fill behind the outline */}
        {waterPath && (
          <g clipPath="url(#water-bottle-clip)">
            <path d={waterPath} fill={fillColor} opacity={0.85} />
          </g>
        )}

        {/* Bottle outline on top */}
        <g transform="translate(0 -540.36)" fill="#60a5fa" opacity={0.9}>
          <circle cx="239.37" cy="962.258" r="7.5" />
          <path d="M326.973,994.96l-8-82v0c-6.4-59.2-4.2-120.1,6.5-180.8c0.1-0.4,0.1-0.9,0.1-1.3c0-4.1,0.3-7.8,0.6-11.8
            c0.3-4.1,0.7-8.4,0.7-13.1c0-0.2,0-0.5,0-0.7c-3.7-38.1-26.4-71.2-52.7-80.3v-37.2h9.6c4.1,0,7.5-3.4,7.5-7.5v-32.4
            c0-4.1-3.4-7.5-7.5-7.5h-87c-4.1,0-7.5,3.4-7.5,7.5v11.9c-22.3,13.4-45.6,29.8-52.4,54.5c0,0.1-0.1,0.2-0.1,0.3
            c-5.2,22.1,14.1,56.2,20.4,66.5c-3.4,12.1-4.2,24.8-2,37.3l2.6,14.9c8.8,57,10.6,116.7,5.2,177.3l-7.9,84.6
            c-0.2,2.1,0.5,4.2,1.9,5.7c1.4,1.6,3.4,2.4,5.5,2.4h157c2.1,0,4.1-0.9,5.6-2.5C326.473,999.16,327.173,997.06,326.973,994.96z
            M276.373,555.36v17.4h-9.6h-52.7h-9.6v-17.4H276.373z M259.273,587.66v34.8h-37.7v-34.8H259.273z M164.473,663.16
            c-7.3-13.7-15.6-33.5-13-45v0c4.8-16.9,20.9-29.9,38-40.8v2.8c0,4.1,3.4,7.5,7.5,7.5h9.6v37.2c-11,3.7-22.1,11.5-31.3,22.4
            C171.073,652.26,167.473,657.56,164.473,663.16z M311.373,717.76c-0.3,3.9-0.7,8-0.7,12.4c-10.9,61.9-13.1,124-6.6,184.3
            l7.1,73.9h-140.3l7.1-76.5c5.5-61.9,3.7-122.8-5.3-181c0-0.1,0-0.1,0-0.2l-2.6-14.9c-3.5-20.6,2.6-42,16.7-58.8
            c10.2-12,23.1-19.5,33.9-19.5h39.5c10.9,0,22.8,7.2,32.7,19.7c10.4,13.2,17.4,31.1,19.2,49.1
            C311.973,710.16,311.673,713.86,311.373,717.76z"/>
          <path d="M281.473,940.26c0-0.1-0.1-0.1-0.1-0.2c-4.6-8.9-7-17.7-7-26.4v-1.2c0-4.1-3.4-7.5-7.5-7.5c-4.1,0-7.5,3.4-7.5,7.5v1.2
            c0,11.1,2.9,22.3,8.7,33.3l3.8,7.8h-5.1c-4.1,0-7.5,3.4-7.5,7.5s3.4,7.5,7.5,7.5h17.1v0c2.6,0,5-1.3,6.4-3.5
            c1.4-2.2,1.5-5,0.4-7.3L281.473,940.26z"/>
        </g>
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
          <p className="text-[10px] text-blue-400/50 mt-0.5">
            {waterPct >= 100 ? '🎉 Goal reached!' : `${formatWater(waterGoal - waterTotal)} left`}
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
