import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Dumbbell, Droplets, Flame, TrendingUp, ChevronRight, Plus, Activity } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import Card from '../components/ui/Card'
import ProgressRing from '../components/ui/ProgressRing'
import ProgressBar from '../components/ui/ProgressBar'
import { useActivePlan } from '../hooks/useActivePlan'
import { useTodayWater } from '../hooks/useTodayWater'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWorkout } from '../hooks/useTodayWorkout'
import { totalWater, totalCalories, pct, formatWater } from '../utils/calculations'
import { getDayOfWeek } from '../utils/dateHelpers'
import { getSettings } from '../db'

export default function Dashboard() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const todayWater = useTodayWater()
  const todayMeals = useTodayMeals()
  const todayWorkout = useTodayWorkout()
  const settings = useLiveQuery(() => getSettings())

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
      <div className="pt-12 pb-6">
        <p className="text-[#666666] text-sm mb-1">{format(today, 'EEEE, MMMM d')}</p>
        <h1 className="text-2xl font-black text-white">
          {settings?.name ? `Hey, ${settings.name} 👋` : 'Good day!'}
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
        <Card
          padding="md"
          hover
          border
          className="mb-4"
          onClick={() => navigate('/plan')}
        >
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

      {/* Today's Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Workout */}
        <Card padding="md" hover onClick={() => navigate('/workout')}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 bg-[#FF6B35]/10 rounded-xl flex items-center justify-center">
                <Dumbbell size={16} className="text-[#FF6B35]" />
              </div>
              {isRestDay && (
                <span className="text-[10px] bg-[#2A2A2A] text-[#666666] px-2 py-0.5 rounded-full">Rest</span>
              )}
            </div>
            <div>
              <p className="text-xs text-[#666666] mb-0.5">Workout</p>
              <p className="text-xl font-black text-white">
                {isRestDay ? '—' : `${completedExercises}/${plannedExercises}`}
              </p>
            </div>
            {!isRestDay && plannedExercises > 0 && (
              <ProgressBar value={workoutPct} color="orange" height="sm" />
            )}
          </div>
        </Card>

        {/* Water */}
        <Card padding="md" hover onClick={() => navigate('/nutrition')}>
          <div className="flex flex-col gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Droplets size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-[#666666] mb-0.5">Water</p>
              <p className="text-xl font-black text-white">{formatWater(waterTotal)}</p>
              <p className="text-xs text-[#555555]">of {formatWater(waterGoal)}</p>
            </div>
            <ProgressBar value={waterPct} color="blue" height="sm" />
          </div>
        </Card>

        {/* Calories */}
        <Card padding="md" hover onClick={() => navigate('/nutrition')}>
          <div className="flex flex-col gap-3">
            <div className="w-8 h-8 bg-[#00FF87]/10 rounded-xl flex items-center justify-center">
              <Flame size={16} className="text-[#00FF87]" />
            </div>
            <div>
              <p className="text-xs text-[#666666] mb-0.5">Calories</p>
              <p className="text-xl font-black text-white">{calorieTotal}</p>
              <p className="text-xs text-[#555555]">of {calorieGoal} kcal</p>
            </div>
            <ProgressBar value={caloriePct} color="green" height="sm" />
          </div>
        </Card>

        {/* Progress */}
        <Card padding="md" hover onClick={() => navigate('/progress')}>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing
              value={workoutPct}
              size={72}
              strokeWidth={7}
              label={`${workoutPct}%`}
              sublabel="done"
            />
            <p className="text-xs text-[#666666] text-center">Weekly Progress</p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3">Quick Actions</p>
      <div className="space-y-2">
        <QuickAction
          icon={<TrendingUp size={18} className="text-[#00FF87]" />}
          label="View Progress Charts"
          sub="Compare plan vs actual"
          onClick={() => navigate('/progress')}
        />
        <QuickAction
          icon={<Dumbbell size={18} className="text-[#FF6B35]" />}
          label="Browse Exercise Library"
          sub="50+ exercises available"
          onClick={() => navigate('/library')}
        />
      </div>
    </div>
  )
}

function QuickAction({
  icon, label, sub, onClick,
}: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <Card padding="sm" hover border onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#0D0D0D] rounded-xl flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-[#555555]">{sub}</p>
        </div>
        <ChevronRight size={16} className="text-[#555555] flex-shrink-0" />
      </div>
    </Card>
  )
}
