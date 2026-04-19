import { format, subDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db, getSettings } from '../../db'
import { useTodayMeals } from '../../hooks/useTodayMeals'
import { pct, totalCalories, totalMacros } from '../../utils/calculations'
import { getTodayString } from '../../utils/dateHelpers'
import { hapticMedium } from '../../utils/haptics'
import { getCurrentMealType } from '../../utils/mealHelpers'
import { MEAL_EMOJIS } from '../../data/constants'
import LogMealModal from '../modals/LogMealModal'

// Generates a wave-topped filled path
function makeWavePath(surfaceY: number, phase: number, W: number, bottom: number, amp = 4) {
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

// The food SVG viewBox is "0 0 512 512"
// The body of the utensil (cup/body part) occupies roughly:
//   X: ~143 to ~345, Y: ~627 to ~1003 in original coords with no transform
//   Since there's no group transform on the food SVG, coords are direct.
//   Fill area top ≈ Y=320 (inside body, below neck), bottom ≈ Y=505
const FOOD_VB = 512

function FoodIcon({ percentage }: { percentage: number }) {
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

  // Fill spans the full SVG height so the level visibly rises across the whole icon
  const fillTop = 0
  const fillBottom = 512
  const fillRange = fillBottom - fillTop
  const surfaceY = fillBottom - (fillRange * clamped) / 100

  const waterPath = clamped > 0
    ? (isAnimating
        ? makeWavePath(surfaceY, wavePhase, FOOD_VB, fillBottom)
        : `M 0 ${surfaceY} L ${FOOD_VB} ${surfaceY} L ${FOOD_VB} ${fillBottom} L 0 ${fillBottom} Z`)
    : null

  // Color: red → amber → green → red(over) as level increases past goal
  const fillColor = percentage > 100 ? '#ef4444' : `hsl(${clamped * 1.4}, 85%, 52%)`

  const iconColor =
    percentage > 100 ? '#ef4444' : clamped < 50 ? '#ef4444' : clamped < 80 ? '#f59e0b' : '#22c55e'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <svg viewBox="0 0 512 512" width="80" height="80" style={{ overflow: 'visible' }}>
        <defs>
          <clipPath id="food-icon-clip">
            <path d="M488.206,177.28c-32.747-73.707-98.667-124.8-143.36-131.627c-42.987-6.613-68.693-4.053-83.627,0.107V10.667
              C261.219,4.8,256.419,0,250.553,0h-42.667c-5.867,0-10.667,4.8-10.667,10.667v76.907c-7.787,13.12-10.987,28.48-9.067,43.52
              c3.2,26.24,20.267,51.627,50.773,75.52c37.333,29.12,40.32,62.08,30.72,83.093c-10.773,23.787-37.44,35.307-67.627,29.44
              c-10.773-2.133-22.187-4.693-33.707-7.253c-53.973-12.16-109.76-24.64-141.12,0.427c-14.613,11.84-21.973,30.4-21.973,55.467
              v133.547c0,5.867,4.8,10.667,10.667,10.667h53.333c5.867,0,10.667-4.8,10.667-10.667v-85.44c0-0.32,0.213-8.427,6.4-11.84
              c4.8-2.667,20.48-6.08,61.653,18.773c99.093,60.053,237.12,75.52,327.253-61.12C522.126,290.667,508.153,222.187,488.206,177.28z"/>
          </clipPath>
        </defs>

        {/* Fill behind outline */}
        {waterPath && (
          <g clipPath="url(#food-icon-clip)">
            <path d={waterPath} fill={fillColor} opacity={0.85} />
          </g>
        )}

        {/* Outline on top */}
        <path
          fill={iconColor}
          opacity={0.9}
          d="M488.206,177.28c-32.747-73.707-98.667-124.8-143.36-131.627c-42.987-6.613-68.693-4.053-83.627,0.107V10.667
            C261.219,4.8,256.419,0,250.553,0h-42.667c-5.867,0-10.667,4.8-10.667,10.667v76.907c-7.787,13.12-10.987,28.48-9.067,43.52
            c3.2,26.24,20.267,51.627,50.773,75.52c37.333,29.12,40.32,62.08,30.72,83.093c-10.773,23.787-37.44,35.307-67.627,29.44
            c-10.773-2.133-22.187-4.693-33.707-7.253c-53.973-12.16-109.76-24.64-141.12,0.427c-14.613,11.84-21.973,30.4-21.973,55.467
            v133.547c0,5.867,4.8,10.667,10.667,10.667h53.333c5.867,0,10.667-4.8,10.667-10.667v-85.44c0-0.32,0.213-8.427,6.4-11.84
            c4.8-2.667,20.48-6.08,61.653,18.773c99.093,60.053,237.12,75.52,327.253-61.12C522.126,290.667,508.153,222.187,488.206,177.28z
            M457.379,349.973c-81.92,124.053-207.893,109.547-298.453,54.72c-37.973-23.04-65.28-29.227-83.307-19.093
            c-13.547,7.68-17.067,22.613-17.067,30.187v74.88h-32v-122.88c0-18.56,4.587-31.147,13.973-38.72
            c23.36-18.667,76.267-6.72,123.093,3.733c11.733,2.667,23.36,5.227,34.347,7.36c40.427,7.893,76.053-8.533,91.093-41.6
            c16.32-35.84,1.707-78.507-37.013-108.8c-65.707-51.307-37.013-90.88-35.84-92.48c1.493-1.92,2.24-4.16,2.24-6.613V21.333h21.333
            v40.853c-0.107,4.267,2.453,8.213,6.293,10.027c3.84,1.707,8.32,0.96,11.413-2.027c0.213-0.107,18.027-13.547,83.947-3.52
            c38.4,5.867,98.667,55.147,127.147,119.253C486.499,226.027,498.979,286.933,457.379,349.973z"
        />
      </svg>
    </div>
  )
}

export default function FoodSection() {
  const todayMeals = useTodayMeals()
  const settings = useLiveQuery(() => getSettings())
  const [showModal, setShowModal] = useState(false)
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set())

  const currentMealType = getCurrentMealType()

  const calorieTotal = totalCalories(todayMeals)
  const calorieGoal = settings?.calorieGoal ?? 2000
  const caloriePct = pct(calorieTotal, calorieGoal)
  const macros = totalMacros(todayMeals)
  const remaining = Math.max(0, calorieGoal - calorieTotal)

  const recentFoods = useLiveQuery(async () => {
    const cutoff = format(subDays(new Date(), 60), 'yyyy-MM-dd')
    const logs = await db.mealLogs
      .where('mealType').equals(currentMealType)
      .filter((m) => m.date >= cutoff)
      .toArray()
    const map = new Map<string, { name: string; calories: number; protein: number; carbs: number; fat: number; count: number }>()
    for (const l of logs) {
      const e = map.get(l.name)
      if (e) { e.count++ } else { map.set(l.name, { name: l.name, calories: l.calories, protein: l.protein, carbs: l.carbs, fat: l.fat, count: 1 }) }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3)
  }, [currentMealType]) ?? []

  const quickLogFood = async (food: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    hapticMedium()
    await db.mealLogs.put({
      id: uuid(),
      date: getTodayString(),
      mealType: currentMealType,
      createdAt: new Date().toISOString(),
      ...food,
    })
    setJustLogged((prev) => new Set(prev).add(food.name))
    setTimeout(() => setJustLogged((prev) => { const n = new Set(prev); n.delete(food.name); return n }), 1500)
  }

  const accentColor = '#ffffff'
  const accentBg = 'from-[#FF8B20] to-[#000000]'
  const borderColor = caloriePct > 100 ? 'border-red-600/50' : 'border-orange-600/40'

  return (
    <div className={`mb-5 rounded-2xl bg-gradient-to-b ${accentBg} border ${borderColor} p-4 shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: `${accentColor}` }}>
            Nutrition
          </p>
          <p className="text-lg font-black text-white mt-0.5">
            {calorieTotal.toLocaleString()}
            <span className="text-sm font-medium ml-1.5" style={{ color: accentColor }}>
              / {calorieGoal.toLocaleString()} kcal
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color: accentColor }}>{Math.round(caloriePct)}%</p>
          <p className="text-[16px] mt-0.5" style={{ color: `${accentColor}90` }}>
            {caloriePct >= 100 ? 'Goal reached!' : `${remaining.toLocaleString()} kcal left`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 mb-4">
        <div className="flex-shrink-0">
          <FoodIcon percentage={caloriePct} />
        </div>

        <div className="flex-1 space-y-2.5">
          {([
            { label: 'Protein', value: macros.protein, max: 150, color: '#4ade80' },
            { label: 'Carbs',   value: macros.carbs,   max: 250, color: '#60a5fa' },
            { label: 'Fat',     value: macros.fat,     max: 65,  color: '#f97316' },
          ] as const).map(({ label, value, max, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="font-semibold" style={{ color }}>{label}</span>
                <span className="text-[#d8d8d8]">{Math.round(value)}g / {max}g</span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, pct(value, max))}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {recentFoods.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-[#ffffff] uppercase tracking-wider font-semibold mb-2">
            {MEAL_EMOJIS[currentMealType]} Quick Log · tap to add
          </p>
          <div className="flex flex-col gap-1.5">
            {recentFoods.map((food) => (
              <button
                key={food.name}
                onClick={() => quickLogFood(food)}
                className="flex items-center justify-between px-3 py-2 bg-black/20 hover:bg-black/30 active:scale-[0.98] rounded-xl transition-all text-left border border-white/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{food.name}</p>
                  <p className="text-xs text-[#555555]">
                    {food.calories} kcal · P:{food.protein}g C:{food.carbs}g F:{food.fat}g
                  </p>
                </div>
                {justLogged.has(food.name)
                  ? <CheckCircle2 size={16} className="shrink-0 ml-3" style={{ color: accentColor }} />
                  : <Plus size={30} className="text-[#555555] p-1 shrink-0 ml-3 border rounded-full bg-orange-300" />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#ff8b2050]"
        style={{ background: `#FF8B20`, color: 'white' }}
      >
        <Plus size={16} />
        Log Food / Meal
      </button>

      <LogMealModal isOpen={showModal} onClose={() => setShowModal(false)} defaultMealType={currentMealType} />
    </div>
  )
}
