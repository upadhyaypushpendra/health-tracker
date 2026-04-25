import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { MEAL_EMOJIS } from '../data/constants'
import SwipeToDelete from '../components/ui/SwipeToDelete'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import WaterSection from '../components/dashboard/WaterSection'
import FoodSection from '../components/dashboard/FoodSection'
import LogMealModal from '../components/modals/LogMealModal'
import { db } from '../db'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { formatWater } from '../utils/calculations'
import { healthSync } from '../services/healthSyncPlugin'
import { syncNotificationStats } from '../services/notificationStats'
import { rescheduleWaterReminders } from '../hooks/useNotifications'
import type { MealLog } from '../db/types'

export default function Nutrition() {
  const waterLog = useTodayWater()
  const meals = useTodayMeals()
  const location = useLocation()
  const autoOpenLogMeal = !!(location.state as any)?.openLogMeal

  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null)

  const deleteMeal = async (id: string) => {
    const meal = await db.mealLogs.get(id)
    if (meal) healthSync.deleteNutritionRecord(meal.createdAt, meal.createdAt)
    await db.mealLogs.delete(id)
    syncNotificationStats()
  }

  const deleteWaterEntry = async (index: number) => {
    if (!waterLog) return
    const entry = waterLog.entries[index]
    healthSync.deleteHydrationRecord(entry.time, entry.time)
    const newEntries = waterLog.entries.filter((_, i) => i !== index)
    if (newEntries.length === 0) {
      await db.waterLogs.delete(waterLog.id)
    } else {
      await db.waterLogs.update(waterLog.id, { entries: newEntries })
    }
    syncNotificationStats()
    rescheduleWaterReminders()
  }

  return (
    <div className="pb-32">
      <PageHeader title="Nutrition" subtitle="Water & Diet" back />

      <div className="px-4 space-y-5">
        {/* ── Water Section ───────────────────────────────────────────── */}
        <WaterSection />

        {/* ── Food / Nutrition Section ────────────────────────────────── */}
        <FoodSection autoOpenModal={autoOpenLogMeal} />

        {/* ── Meal Log ────────────────────────────────────────────────── */}
        {meals.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#aaaaaa] uppercase tracking-wider mb-3">
              Today's Meals <span className="text-[10px] text-[#555555]">(Tap to Edit)</span>
            </p>
            <div className="space-y-2">
              {meals.map((meal) => (
                <SwipeToDelete key={meal.id} onDelete={() => deleteMeal(meal.id)}>
                  <Card border padding="sm">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => setEditingMeal(meal)}
                    >
                      <span className="text-xl">{MEAL_EMOJIS[meal.mealType]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{meal.name}</p>
                        <p className="text-xs text-[#555555]">
                          {meal.calories} kcal · P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMeal(meal.id) }}
                        className="text-red-500 active:text-red-100 transition-colors shrink-0"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </Card>
                </SwipeToDelete>
              ))}
            </div>
          </section>
        )}

        {/* ── Water Log ───────────────────────────────────────────────── */}
        {waterLog && waterLog.entries.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3">Today's Water Log</p>
            <Card border padding="sm">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {waterLog.entries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#1A1A1A] px-1 py-1 rounded-xl">
                    <span className="text-sm text-white">{formatWater(entry.amount)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#555555]">
                        {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => deleteWaterEntry(i)}
                        className="text-red-500 active:text-red-100 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
      </div>

      <LogMealModal
        isOpen={!!editingMeal}
        onClose={() => setEditingMeal(null)}
        editMeal={editingMeal}
      />
    </div>
  )
}
