import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, ChevronRight, Droplets, Dumbbell, Flame, GlassWater, Plus, Sparkles, TrendingUp, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import LogMealModal from '../components/modals/LogMealModal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { db, getSettings } from '../db'
import type { WaterLog } from '../db/types'
import { useActivePlan } from '../hooks/useActivePlan'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { useTodayWorkout } from '../hooks/useTodayWorkout'
import { formatWater, pct, totalCalories, totalWater } from '../utils/calculations'
import { getDayOfWeek, getTodayString } from '../utils/dateHelpers'
import CompactState from '../components/CompactState'

const WATER_PRESETS = [
  { label: '½ glass', amount: 125 },
  { label: '1 glass', amount: 250 },
  { label: '500ml', amount: 500 },
  { label: '1L', amount: 1000 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const todayWater = useTodayWater()
  const todayMeals = useTodayMeals()
  const todayWorkout = useTodayWorkout()
  const settings = useLiveQuery(() => getSettings())

  const [showMealModal, setShowMealModal] = useState(false)

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

  // ── Water handler ───────────────────────────────────────────────────────────
  const addWater = async (amount: number) => {
    if (amount <= 0) return
    const entry = { amount, time: new Date().toISOString() }
    if (todayWater) {
      await db.waterLogs.update(todayWater.id, { entries: [...todayWater.entries, entry] })
    } else {
      const log: WaterLog = {
        id: uuid(), date: getTodayString(),
        entries: [entry], goal: settings?.waterGoal ?? 3000,
      }
      await db.waterLogs.put(log)
    }
  }

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
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {WATER_PRESETS.map(({ label, amount }) => (
            <button
              key={label}
              onClick={() => addWater(amount)}
              className="flex flex-col items-center justify-center gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-400 text-[10px] font-bold py-2 rounded-xl transition-all"
            >
              <GlassWater size={12} />
              +{label}
            </button>
          ))}
        </div>
      </div>

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
      <div className="mb-4">
        <p className="text-xs text-[#666666] uppercase tracking-wider font-semibold mb-3">AI Assistant</p>
        <div className="grid grid-cols-2 gap-3">
          <Card padding="md" hover border className="border-[#00FF87]/10" onClick={() => navigate('/ai?mode=feedback')}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#00FF87]/10 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-[#00FF87]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">AI Coach</p>
                <p className="text-xs text-[#555555]">Analyze progress</p>
              </div>
            </div>
          </Card>
          <Card padding="md" hover border className="border-[#FF6B35]/10" onClick={() => navigate('/ai?mode=plan')}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#FF6B35]/10 rounded-xl flex items-center justify-center shrink-0">
                <Wand2 size={18} className="text-[#FF6B35]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">AI Plan</p>
                <p className="text-xs text-[#555555]">Create with AI</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <LogMealModal isOpen={showMealModal} onClose={() => setShowMealModal(false)} />
    </div>
  )
}
