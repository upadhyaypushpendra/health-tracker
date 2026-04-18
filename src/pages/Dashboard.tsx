import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, ChevronRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AIQuickActions } from '../components/AIQuickActions'
import FoodSection from '../components/dashboard/FoodSection'
import WaterSection from '../components/dashboard/WaterSection'
import Card from '../components/ui/Card'
import { getSettings } from '../db'
import { useActivePlan } from '../hooks/useActivePlan'
import { useTodayWorkout } from '../hooks/useTodayWorkout'
import { pct } from '../utils/calculations'
import { getDayOfWeek } from '../utils/dateHelpers'

export default function Dashboard() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const todayWorkout = useTodayWorkout()
  const settings = useLiveQuery(() => getSettings())

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
              {!isRestDay && workoutPct > 0 && (
                <div className="w-16 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00FF87] transition-all duration-500"
                    style={{ width: `${workoutPct}%` }}
                  />
                </div>
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

      {/* Water Section */}
      <WaterSection />

      {/* Food / Nutrition Section */}
      <FoodSection />

      {/* AI Quick Actions */}
      <AIQuickActions />
    </div>
  )
}
