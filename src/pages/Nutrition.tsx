import { useLiveQuery } from 'dexie-react-hooks'
import { Droplets, Flame, GlassWater, Plus } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import LogMealModal from '../components/modals/LogMealModal'
import { MEAL_EMOJIS } from '../data/constants'
import SwipeToDelete from '../components/ui/SwipeToDelete'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ProgressRing from '../components/ui/ProgressRing'

const MacroDonut = lazy(() =>
  import('../components/charts/MacroDonut').then(m => ({ default: m.MacroDonut }))
)
import { db, getSettings } from '../db'
import { useAddWater } from '../hooks/useAddWater'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { formatWater, pct, totalCalories, totalMacros, totalWater } from '../utils/calculations'
import { hapticLight } from '../utils/haptics'
import { getCurrentMealType } from '../utils/mealHelpers'

// ── Water presets ─────────────────────────────────────────────────────────────
const WATER_PRESETS = [
  { label: '½ glass', amount: 125 },
  { label: '1 glass', amount: 250 },
  { label: '500ml', amount: 500 },
  { label: '1L', amount: 1000 },
]

export default function Nutrition() {
  const waterLog = useTodayWater()
  const meals = useTodayMeals()
  const settings = useLiveQuery(() => getSettings())

  // ── Water state ────────────────────────────────────────────────────────
  const [customWater, setCustomWater] = useState('')

  // ── Meal modal ─────────────────────────────────────────────────────────
  const [showMealModal, setShowMealModal] = useState(false)

  // ── Computed ──────────────────────────────────────────────────────────
  const waterGoal = settings?.waterGoal ?? waterLog?.goal ?? 3000
  const waterTotal = totalWater(waterLog?.entries ?? [])
  const waterPct = pct(waterTotal, waterGoal)

  const calorieTotal = totalCalories(meals)
  const calorieGoal = settings?.calorieGoal ?? 2000
  const caloriePct = pct(calorieTotal, calorieGoal)
  const macros = totalMacros(meals)

  // ── Handlers ──────────────────────────────────────────────────────────
  const addWater = useAddWater()

  const removeWaterEntry = async (idx: number) => {
    if (!waterLog) return
    await db.waterLogs.update(waterLog.id, {
      entries: waterLog.entries.filter((_, i) => i !== idx),
    })
  }

  const deleteMeal = async (id: string) => {
    await db.mealLogs.delete(id)
  }

  return (
    <div className="pb-32">
      <PageHeader title="Nutrition" subtitle="Water & Diet" back />

      <div className="px-4 space-y-5">
        {/* ── Water Section ───────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Droplets size={12} className="text-blue-400" /> Water Intake
          </p>
          <Card border>
            {/* Ring + stats row */}
            <div className="flex items-center gap-5 mb-4">
              <ProgressRing
                value={waterPct}
                size={96}
                strokeWidth={9}
                color="#60A5FA"
                label={formatWater(waterTotal)}
                sublabel={`of ${formatWater(waterGoal)}`}
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-0.5">{waterPct}% of daily goal</p>
                <p className="text-xs text-[#555555]">{formatWater(waterGoal - waterTotal)} remaining</p>
              </div>
            </div>

            {/* Quick-add presets */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {WATER_PRESETS.map(({ label, amount }) => (
                <button
                  key={label}
                  className="flex items-center justify-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold py-2 rounded-xl transition-all"
                  onClick={() => { hapticLight(); addWater(amount) }}
                >
                  <GlassWater size={11} className="text-blue-400" />
                  +{label}
                </button>
              ))}
            </div>

            {/* Custom ml input */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Custom ml"
                className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-[#444444] outline-none focus:border-blue-400"
                value={customWater}
                onChange={(e) => setCustomWater(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { addWater(parseInt(customWater) || 0); setCustomWater('') }
                }}
              />
              <button
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                onClick={() => { hapticLight(); addWater(parseInt(customWater) || 0); setCustomWater('') }}
              >
                Add
              </button>
            </div>

            {/* Today's entries */}
            {waterLog && waterLog.entries.length > 0 && (
              <div className="mt-4 border-t border-[#2A2A2A] pt-3">
                <p className="text-[10px] text-[#555555] uppercase tracking-wider mb-2">Today's Log</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {waterLog.entries.map((entry, i) => (
                    <SwipeToDelete key={i} onDelete={() => removeWaterEntry(i)}>
                      <div className="flex items-center gap-2 bg-[#1A1A1A] px-2 py-1.5 rounded-xl">
                        <GlassWater size={11} className="text-blue-400/60" />
                        <span className="text-sm text-white">{formatWater(entry.amount)}</span>
                        <span className="text-xs text-[#555555]">
                          {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </SwipeToDelete>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* ── Calories Section ────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame size={12} className="text-[#00FF87]" /> Calories & Macros
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card border>
              <p className="text-xs text-[#666666] mb-1">Calories</p>
              <p className="text-2xl font-black text-white">{calorieTotal}</p>
              <p className="text-xs text-[#555555]">of {calorieGoal} kcal</p>
              <div className="mt-2 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00FF87] rounded-full transition-all duration-500"
                  style={{ width: `${caloriePct}%` }}
                />
              </div>
            </Card>

            <Card border className="flex items-center justify-center">
              {macros.protein + macros.carbs + macros.fat > 0 ? (
                <Suspense fallback={<div className="w-20 h-20 rounded-full bg-[#2A2A2A] animate-pulse" />}>
                  <MacroDonut protein={macros.protein} carbs={macros.carbs} fat={macros.fat} size={80} />
                </Suspense>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-[#666666] mb-1">Macros</p>
                  <p className="text-xs text-[#444444]">Log food to see</p>
                </div>
              )}
            </Card>
          </div>

          {macros.protein + macros.carbs + macros.fat > 0 && (
            <Card border className="mb-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-[#00FF87]">{macros.protein.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Protein</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#FF6B35]">{macros.carbs.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Carbs</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#FF4757]">{macros.fat.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Fat</p>
                </div>
              </div>
            </Card>
          )}

          {/* Meal list */}
          <div className="space-y-2 mb-3">
            {meals.map((meal) => (
              <SwipeToDelete key={meal.id} onDelete={() => deleteMeal(meal.id)}>
                <Card border padding="sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{MEAL_EMOJIS[meal.mealType]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{meal.name}</p>
                      <p className="text-xs text-[#555555]">
                        {meal.calories} kcal · P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                      </p>
                    </div>
                  </div>
                </Card>
              </SwipeToDelete>
            ))}
          </div>

          <Button fullWidth variant="outline" icon={<Plus size={16} />} onClick={() => setShowMealModal(true)}>
            Log Food / Meal
          </Button>
        </section>
      </div>

      <LogMealModal
        isOpen={showMealModal}
        onClose={() => setShowMealModal(false)}
        defaultMealType={getCurrentMealType()}
      />
    </div>
  )
}
