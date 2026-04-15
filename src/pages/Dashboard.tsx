import { format, subDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, CheckCircle2, ChevronRight, Droplets, Dumbbell, Flame, GlassWater, Plus, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { AIQuickActions } from '../components/AIQuickActions'
import CompactState from '../components/CompactState'
import LogMealModal from '../components/modals/LogMealModal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { MEAL_EMOJIS } from '../data/constants'
import { db, getSettings } from '../db'
import { useActivePlan } from '../hooks/useActivePlan'
import { useAddWater } from '../hooks/useAddWater'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { useTodayWorkout } from '../hooks/useTodayWorkout'
import { formatWater, pct, totalCalories, totalWater } from '../utils/calculations'
import { getDayOfWeek, getTodayString } from '../utils/dateHelpers'
import { hapticLight, hapticMedium } from '../utils/haptics'
import { getCurrentMealType } from '../utils/mealHelpers'

const WATER_PRESETS = [
  { label: '½ glass', amount: 125 },
  { label: '1 glass', amount: 250 },
  { label: '2 glasses', amount: 500 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const todayWater = useTodayWater()
  const todayMeals = useTodayMeals()
  const todayWorkout = useTodayWorkout()
  const settings = useLiveQuery(() => getSettings())
  const addWater = useAddWater()

  const [showMealModal, setShowMealModal] = useState(false)
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set())

  // ── Recent foods ─────────────────────────────────────────────────────────────
  const currentMealType = getCurrentMealType()
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
  }, [currentMealType]) ?? [];

  const quickLogFood = async (food: { name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    hapticMedium()
    await db.mealLogs.put({ id: uuid(), date: getTodayString(), mealType: currentMealType, createdAt: new Date().toISOString(), ...food })
    setJustLogged((prev) => new Set(prev).add(food.name))
    setTimeout(() => setJustLogged((prev) => { const n = new Set(prev); n.delete(food.name); return n }), 1500)
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const waterTotal = totalWater(todayWater?.entries ?? [])
  const waterGoal = settings?.waterGoal ?? todayWater?.goal ?? 3000
  const waterPct = pct(waterTotal, waterGoal)

  const calorieTotal = totalCalories(todayMeals)
  const calorieGoal = settings?.calorieGoal ?? 2000
  const caloriePct = pct(calorieTotal, calorieGoal)

  const todayDOW = getDayOfWeek()
  const todayPlan = activePlan?.weekTemplate.find((d) => d.dayOfWeek === todayDOW)
  const isRestDay = todayPlan?.isRest ?? false
  const plannedExercises = todayPlan?.exercises.length ?? 0
  const completedExercises = todayWorkout?.exercises.filter((e) => e.completed).length ?? 0
  const workoutPct = plannedExercises > 0 ? pct(completedExercises, plannedExercises) : 0

  const today = new Date()

  return (
    <div className="px-4 pb-6 safe-top">
      {/* Header */}
      <div className="pt-0 pb-5">
        <p className="text-[#666666] text-sm mb-1">{format(today, 'EEEE, MMMM d')}</p>
        <h1 className="text-2xl font-black text-white">
          {settings?.name ? `Hey, ${settings.name}` : 'Good day!'}
        </h1>
      </div>

      {/* Active Plan Banner */}
      {activePlan ? (
        <Card
          padding="md"
          hover
          border
          className="mb-4 border-[#00FF87]/20 bg-gradient-to-r from-[#1A1A1A] to-[#0D2A1A]"
          onClick={() => navigate('/workout')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#00FF87]/10 rounded-xl flex items-center justify-center">
                <Activity size={20} className="text-[#00FF87]" />
              </div>
              <div>
                <p className="text-xs text-[#00FF87] font-semibold uppercase tracking-wider mb-0.5">Active Plan</p>
                <p className="text-sm font-bold text-white">{activePlan.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRestDay ? (
                <span className="text-xs bg-[#2A2A2A] text-[#A0A0A0] px-3 py-1 rounded-full">Rest Day</span>
              ) : (
                <span className="text-xs text-[#A0A0A0]">{completedExercises}/{plannedExercises} done</span>
              )}
              <ChevronRight size={16} className="text-[#666666]" />
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="md" hover border className="mb-4" onClick={() => navigate('/plan')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center border border-dashed border-[#3A3A3A]">
              <Plus size={20} className="text-[#666666]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#A0A0A0]">No active plan</p>
              <p className="text-xs text-[#555555]">Create a workout plan to get started</p>
            </div>
            <ChevronRight size={16} className="text-[#666666] ml-auto" />
          </div>
        </Card>
      )}

      {/* ── Compact Stats Grid ── */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {/* Workout */}
        <CompactState
          name='Workout'
          navigateTo="/workout"
          isRestDay={isRestDay}
          value={`${completedExercises}/${plannedExercises}`}
          unit=''
          percentage={workoutPct}
          Icon={Dumbbell}
          iconColor="#FF6B35"
        />

        {/* Water */}
        <CompactState
          name='Water'
          navigateTo="/nutrition"
          isRestDay={false}
          value={formatWater(waterTotal)}
          percentage={waterPct}
          Icon={Droplets}
          iconColor="#086DD2"
        />

        {/* Calories */}
        <CompactState
          name="Calories"
          navigateTo="/nutrition"
          isRestDay={false}
          value={calorieTotal}
          unit='kcal'
          percentage={caloriePct}
          Icon={Flame}
          iconColor="#00FF87"
        />

        {/* Weekly Progress */}
        <CompactState
          name="Weekly Progress"
          navigateTo="/progress"
          isRestDay={false}
          value={workoutPct}
          unit={'%'}
          percentage={workoutPct}
          Icon={TrendingUp}
          iconColor="#00FF87"
        />
      </div>

      {/* ── Water Quick Log ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#666666] uppercase tracking-wider font-semibold">Water</p>
          <span className="text-xs text-blue-400 font-medium">
            {formatWater(waterTotal)} / {formatWater(waterGoal)}
          </span>
        </div>
        <div className="flex stretch gap-1.5 mb-2">
          {WATER_PRESETS.map(({ label, amount }) => (
            <button
              key={label}
              onClick={() => { hapticLight(); addWater(amount) }}
              className="flex flex-auto flex-col items-center justify-center gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-400 text-[10px] font-bold py-2 rounded-lg transition-all"
            >
              <GlassWater size={12} />
              +{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recently Eaten Quick Log ── */}
      {recentFoods.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-[#666666] uppercase tracking-wider font-semibold">
              {MEAL_EMOJIS[currentMealType]} Quick Log
            </p>
            <span className="text-[10px] text-[#444444]">· tap to log instantly</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {recentFoods.map((food) => (
              <button
                key={food.name}
                onClick={() => quickLogFood(food)}
                className="flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] hover:bg-[#222222] active:scale-[0.98] rounded-xl transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{food.name}</p>
                  <p className="text-xs text-[#555555]">{food.calories} kcal · P:{food.protein}g C:{food.carbs}g F:{food.fat}g</p>
                </div>
                {justLogged.has(food.name)
                  ? <CheckCircle2 size={16} className="text-[#00FF87] shrink-0 ml-3" />
                  : <Plus size={16} className="text-[#555555] shrink-0 ml-3" />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Meal Log ── */}
      <div className="mb-4">
        <Button
          onClick={() => setShowMealModal(true)}
          variant='primary'
          fullWidth
        >
          <Plus size={14} />
          Log Food / Meal
        </Button>
      </div>

      {/* ── AI Quick Actions ── */}
      <AIQuickActions />

      <LogMealModal isOpen={showMealModal} onClose={() => setShowMealModal(false)} defaultMealType={currentMealType} />
    </div>
  )
}
