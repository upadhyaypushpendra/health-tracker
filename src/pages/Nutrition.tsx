import { MEAL_EMOJIS } from '../data/constants'
import SwipeToDelete from '../components/ui/SwipeToDelete'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import WaterSection from '../components/dashboard/WaterSection'
import FoodSection from '../components/dashboard/FoodSection'
import { db } from '../db'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { formatWater } from '../utils/calculations'

export default function Nutrition() {
  const waterLog = useTodayWater()
  const meals = useTodayMeals()

  const deleteMeal = async (id: string) => {
    await db.mealLogs.delete(id)
  }

  return (
    <div className="pb-32">
      <PageHeader title="Nutrition" subtitle="Water & Diet" back />

      <div className="px-4 space-y-5">
        {/* ── Water Section ───────────────────────────────────────────── */}
        <WaterSection />

        {/* ── Food / Nutrition Section ────────────────────────────────── */}
        <FoodSection />

        {/* ── Meal Log ────────────────────────────────────────────────── */}
        {meals.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3">Today's Meals</p>
            <div className="space-y-2">
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
          </section>
        )}

        {/* ── Water Log ───────────────────────────────────────────────── */}
        {waterLog && waterLog.entries.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3">Today's Water Log</p>
            <Card border>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {waterLog.entries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#1A1A1A] px-3 py-2 rounded-xl">
                    <span className="text-sm text-white">{formatWater(entry.amount)}</span>
                    <span className="text-xs text-[#555555]">
                      {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
