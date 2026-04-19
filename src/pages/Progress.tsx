import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { subDays, format, parseISO, eachDayOfInterval } from 'date-fns'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import { useActivePlan } from '../hooks/useActivePlan'
import { db, getSettings } from '../db'
import { toDateString } from '../utils/dateHelpers'
import { totalWater, totalCalories, formatWater } from '../utils/calculations'

const PlanVsActualChart = lazy(() =>
  import('../components/charts/PlanVsActualChart').then(m => ({ default: m.PlanVsActualChart }))
)
const SimpleBarChart = lazy(() =>
  import('../components/charts/SimpleBarChart').then(m => ({ default: m.SimpleBarChart }))
)
const BodyTrendChart = lazy(() =>
  import('../components/charts/BodyTrendChart').then(m => ({ default: m.BodyTrendChart }))
)

type Range = '7d' | '14d' | '30d'

export default function Progress() {
  const [range, setRange] = useState<Range>('7d')
  const activePlan = useActivePlan()
  const settings = useLiveQuery(() => getSettings())

  const days = range === '7d' ? 7 : range === '14d' ? 14 : 30
  const today = new Date()
  const startDate = subDays(today, days - 1)
  const dateRange = eachDayOfInterval({ start: startDate, end: today }).map(toDateString)

  // ── Range-scoped queries ──────────────────────────────────────────────────
  const workoutLogs = useLiveQuery(
    () => db.workoutLogs.where('date').between(dateRange[0], dateRange[dateRange.length - 1], true, true).toArray(),
    [dateRange[0], dateRange[dateRange.length - 1]],
    [],
  )

  const waterLogs = useLiveQuery(
    () => db.waterLogs.where('date').between(dateRange[0], dateRange[dateRange.length - 1], true, true).toArray(),
    [dateRange[0], dateRange[dateRange.length - 1]],
    [],
  )

  const mealLogs = useLiveQuery(
    () => db.mealLogs.where('date').between(dateRange[0], dateRange[dateRange.length - 1], true, true).toArray(),
    [dateRange[0], dateRange[dateRange.length - 1]],
    [],
  )

  const bodyMetrics = useLiveQuery(
    () => db.bodyMetrics.where('date').between(dateRange[0], dateRange[dateRange.length - 1], true, true).toArray(),
    [dateRange[0], dateRange[dateRange.length - 1]],
    [],
  )

  // ── All-time completed workout dates for streak ───────────────────────────
  const allWorkoutDates = useLiveQuery(
    () => db.workoutLogs.filter(l => l.completed).toArray().then(logs => new Set(logs.map(l => l.date))),
    [],
    new Set<string>(),
  )

  const waterGoal = settings?.waterGoal ?? 3000
  const calorieGoal = activePlan?.calorieGoal ?? 2000
  const weightUnit = settings?.weightUnit ?? 'kg'

  // ── Summary stats ─────────────────────────────────────────────────────────
  const workoutStreak = useMemo(() => {
    if (!allWorkoutDates?.size) return 0
    const hasToday = allWorkoutDates.has(toDateString(today))
    let streak = 0
    for (let i = hasToday ? 0 : 1; i < 366; i++) {
      if (allWorkoutDates.has(toDateString(subDays(today, i)))) streak++
      else break
    }
    return streak
  }, [allWorkoutDates])

  const totalWorkouts = workoutLogs?.filter(l => l.completed).length ?? 0

  const avgCalories = useMemo(() => {
    if (!mealLogs?.length) return 0
    const byDate = new Map<string, number>()
    mealLogs.forEach(m => byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.calories))
    const sum = [...byDate.values()].reduce((a, b) => a + b, 0)
    return byDate.size ? Math.round(sum / byDate.size) : 0
  }, [mealLogs])

  const avgWater = useMemo(() => {
    if (!waterLogs?.length) return 0
    return Math.round(waterLogs.reduce((s, w) => s + totalWater(w.entries), 0) / days)
  }, [waterLogs, days])

  // ── PlanVsActual chart data ───────────────────────────────────────────────
  const calorieData = dateRange.map((date) => ({
    date: format(parseISO(date), 'MMM d'),
    actual: totalCalories(mealLogs?.filter((m) => m.date === date) ?? []),
    target: calorieGoal,
  }))

  const waterData = dateRange.map((date) => ({
    date: format(parseISO(date), 'MMM d'),
    actual: totalWater(waterLogs?.find((w) => w.date === date)?.entries ?? []),
    target: waterGoal,
  }))

  const workoutData = dateRange.map((date) => {
    const log = workoutLogs?.find((w) => w.date === date)
    const totalSets = log?.exercises.flatMap((e) => e.sets).length ?? 0
    const doneSets = log?.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length ?? 0
    return { date: format(parseISO(date), 'MMM d'), actual: doneSets, target: totalSets || doneSets }
  })

  // ── Per-exercise summary for Workout Sets card ────────────────────────────
  const workoutExerciseSummary = useMemo(() => {
    if (!workoutLogs?.length) return []

    const planMap = new Map<string, { weight: number; reps: number; sets: number; unit: string }>()
    activePlan?.weekTemplate.forEach(day =>
      day.exercises.forEach(ex => planMap.set(ex.exerciseId, ex))
    )

    const map = new Map<string, {
      name: string; doneSets: number; totalSets: number
      bestValue: number; targetValue: number; unit: string
    }>()

    for (const log of workoutLogs) {
      for (const ex of log.exercises) {
        const planned = planMap.get(ex.exerciseId)
        const isBodyweight = planned?.unit === 'bodyweight' ||
          !ex.sets.some(s => (s.targetWeight ?? 0) > 0)
        const isMinutes = planned?.unit === 'minutes'
        const isMeters  = planned?.unit === 'meters'

        const completedSets = ex.sets.filter(s => s.completed)

        // Best value this session
        let sessionBest: number
        let displayUnit: string
        let targetValue: number

        if (isBodyweight) {
          sessionBest  = completedSets.reduce((s, set) => s + (set.actualReps ?? set.targetReps ?? 0), 0)
          targetValue  = (planned?.sets ?? ex.sets.length) * (planned?.reps ?? ex.sets[0]?.targetReps ?? 0)
          displayUnit  = 'reps'
        } else if (isMinutes) {
          sessionBest  = completedSets.reduce((s, set) => s + (set.actualWeight ?? set.targetWeight ?? 0), 0)
          targetValue  = (planned?.weight ?? 0) * (planned?.sets ?? ex.sets.length)
          displayUnit  = 'min'
        } else if (isMeters) {
          sessionBest  = completedSets.reduce((s, set) => s + (set.actualWeight ?? set.targetWeight ?? 0), 0)
          targetValue  = (planned?.weight ?? 0) * (planned?.sets ?? ex.sets.length)
          displayUnit  = 'm'
        } else {
          sessionBest  = completedSets.length ? Math.max(...completedSets.map(s => s.actualWeight ?? 0)) : 0
          targetValue  = planned?.weight ?? ex.sets[0]?.targetWeight ?? 0
          displayUnit  = weightUnit
        }

        const existing = map.get(ex.name)
        if (existing) {
          existing.doneSets  += completedSets.length
          existing.totalSets += ex.sets.length
          existing.bestValue  = Math.max(existing.bestValue, sessionBest)
        } else {
          map.set(ex.name, {
            name: ex.name,
            doneSets:    completedSets.length,
            totalSets:   ex.sets.length,
            bestValue:   sessionBest,
            targetValue,
            unit:        displayUnit,
          })
        }
      }
    }

    return [...map.values()].filter(ex => ex.totalSets > 0)
  }, [workoutLogs, activePlan, weightUnit])

  // ── Weekly workout frequency (14d / 30d) ─────────────────────────────────
  const weeklyFrequency = useMemo(() => {
    const numWeeks = Math.ceil(days / 7)
    return Array.from({ length: numWeeks }, (_, w) => {
      const weekEnd = subDays(today, (numWeeks - 1 - w) * 7)
      const weekStart = subDays(weekEnd, 6)
      const startStr = toDateString(weekStart < startDate ? startDate : weekStart)
      const endStr = toDateString(weekEnd)
      const count = workoutLogs?.filter(l => l.date >= startStr && l.date <= endStr && l.completed).length ?? 0
      return { label: format(weekStart < startDate ? startDate : weekStart, 'MMM d'), value: count }
    })
  }, [workoutLogs, days])

  // ── Weight chart data ─────────────────────────────────────────────────────
  const weightChartData = useMemo(() => {
    if (!bodyMetrics?.length) return []
    return [...bodyMetrics]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(m => ({ date: m.date, weight: m.weight, bmi: m.bmi, bodyFat: m.bodyFat }))
  }, [bodyMetrics])

  // ── Exercise volume progression (active plan exercises only) ─────────────
  const exerciseVolume = useMemo(() => {
    if (!workoutLogs?.length || !activePlan) return []

    const planExerciseIds = new Set<string>()
    const planUnitMap = new Map<string, string>()
    activePlan.weekTemplate.forEach(day =>
      day.exercises.forEach(ex => {
        planExerciseIds.add(ex.exerciseId)
        planUnitMap.set(ex.exerciseId, ex.unit)
      })
    )
    if (!planExerciseIds.size) return []

    const byExercise = new Map<string, { values: number[]; unit: string }>()

    for (const log of [...workoutLogs].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const ex of log.exercises) {
        if (!planExerciseIds.has(ex.exerciseId)) continue
        const unit = planUnitMap.get(ex.exerciseId) ?? 'kg'
        const isTimeBased = unit === 'minutes' || unit === 'meters'
        const isBodyweight = unit === 'bodyweight'
        const displayUnit = isBodyweight ? 'reps' : unit === 'minutes' ? 'min' : unit === 'meters' ? 'm' : weightUnit

        let sessionValue: number
        if (isBodyweight) {
          const completedSets = ex.sets.filter(s => s.completed)
          if (!completedSets.length) continue
          sessionValue = completedSets.reduce((sum, s) => sum + (s.actualReps ?? s.targetReps ?? 0), 0)
        } else if (isTimeBased) {
          const completedSets = ex.sets.filter(s => s.completed)
          if (!completedSets.length) continue
          sessionValue = Math.max(...completedSets.map(s => s.actualWeight ?? s.targetWeight ?? 0))
        } else {
          const completedSets = ex.sets.filter(s => s.completed && (s.actualWeight ?? 0) > 0)
          if (!completedSets.length) continue
          sessionValue = Math.max(...completedSets.map(s => s.actualWeight ?? 0))
        }

        const entry = byExercise.get(ex.name)
        if (entry) { entry.values.push(sessionValue) }
        else { byExercise.set(ex.name, { values: [sessionValue], unit: displayUnit }) }
      }
    }

    const progressions: { name: string; first: number; last: number; delta: number; pct: number; unit: string }[] = []
    for (const [name, { values, unit }] of byExercise) {
      if (values.length < 2) continue
      const first = values[0]
      const last = values[values.length - 1]
      if (first === 0) continue
      const delta = +(last - first).toFixed(1)
      const pct = Math.round((delta / first) * 100)
      progressions.push({ name, first, last, delta, pct, unit })
    }

    return progressions.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5)
  }, [workoutLogs, activePlan, weightUnit])

  return (
    <div className="pb-32">
      <PageHeader title="Progress" subtitle="Your stats at a glance" back />

      <div className="px-4 space-y-5">
        {/* ── Range selector ── */}
        <div className="flex gap-2">
          {(['7d', '14d', '30d'] as Range[]).map((r) => (
            <button
              key={r}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                range === r ? 'bg-[#00FF87] text-[#0D0D0D]' : 'bg-[#1A1A1A] text-[#666666]'
              }`}
              onClick={() => setRange(r)}
            >
              {r === '7d' ? '1 Week' : r === '14d' ? '2 Weeks' : '1 Month'}
            </button>
          ))}
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-2 gap-2">
          <Card border>
            <p className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider mb-1">🔥 Streak</p>
            <p className="text-2xl font-black text-white">{workoutStreak}</p>
            <p className="text-xs text-[#555555]">day{workoutStreak !== 1 ? 's' : ''} in a row</p>
          </Card>
          <Card border>
            <p className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider mb-1">💪 Workouts</p>
            <p className="text-2xl font-black text-white">{totalWorkouts}</p>
            <p className="text-xs text-[#555555]">in this period</p>
          </Card>
          <Card border>
            <p className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider mb-1">Avg Calories</p>
            <p className="text-2xl font-black text-white">{avgCalories || '—'}</p>
            <p className="text-xs text-[#555555]">kcal / day</p>
          </Card>
          <Card border>
            <p className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider mb-1">💧 Avg Water</p>
            <p className="text-2xl font-black text-white">{avgWater ? formatWater(avgWater) : '—'}</p>
            <p className="text-xs text-[#555555]">per day</p>
          </Card>
        </div>

        {/* ── Weekly frequency bar chart (14d / 30d only) ── */}
        {days >= 14 && (
          <Card border>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">📅 Workout Frequency</p>
            <Suspense fallback={<div className="h-36 bg-[#2A2A2A] rounded-xl animate-pulse" />}>
              <SimpleBarChart data={weeklyFrequency} color="#FF6B35" unit=" sessions" goodThreshold={3} />
            </Suspense>
            <p className="text-[10px] text-[#444444] mt-1 text-center">per week · orange = 3+ sessions</p>
          </Card>
        )}

        {/* ── Plan vs Actual line charts ── */}
        <Suspense fallback={
          <div className="space-y-4">
            {[0, 1, 2].map(i => <div key={i} className="h-40 bg-[#2A2A2A] rounded-2xl animate-pulse" />)}
          </div>
        }>
          <Card border>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">🔥 Calories vs Goal</p>
            <PlanVsActualChart data={calorieData} unit="kcal" referenceLine={calorieGoal} />
          </Card>
          <Card border>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">💧 Water vs Goal</p>
            <PlanVsActualChart data={waterData} unit="ml" />
          </Card>
          <Card border>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">💪 Workout Sets</p>
            <PlanVsActualChart data={workoutData} unit="sets" />
            {workoutExerciseSummary.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#2A2A2A] space-y-3">
                {workoutExerciseSummary.map(ex => {
                  const pct = ex.totalSets > 0 ? Math.round((ex.doneSets / ex.totalSets) * 100) : 0
                  const delta = +(ex.bestValue - ex.targetValue).toFixed(1)
                  const hasTarget = ex.targetValue > 0
                  return (
                    <div key={ex.name}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-white truncate flex-1 mr-2">{ex.name}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-white">{ex.bestValue}{ex.unit}</span>
                          {hasTarget && delta !== 0 && (
                            <span className={`text-[10px] font-semibold ${delta > 0 ? 'text-[#00FF87]' : 'text-[#FF4757]'}`}>
                              {delta > 0 ? '+' : ''}{delta}{ex.unit} {delta > 0 ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#00FF87]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-[#555555] shrink-0">{ex.doneSets}/{ex.totalSets} sets</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Suspense>

        {/* ── Weight tracking ── */}
        {weightChartData.length >= 1 && (
          <Suspense fallback={<div className="h-44 bg-[#2A2A2A] rounded-2xl animate-pulse" />}>
            <Card border>
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">⚖️ Weight</p>
              <BodyTrendChart data={weightChartData} goalWeight={activePlan?.weightGoal ?? null} />
            </Card>
          </Suspense>
        )}

        {/* ── Exercise volume progression ── */}
        {exerciseVolume.length > 0 && (
          <>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider">📈 Exercise Progress</p>
            <div className="space-y-2">
              {exerciseVolume.map((ex) => (
                <Card key={ex.name} border padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{ex.name}</p>
                      <p className="text-xs text-[#555555]">
                        {ex.first}{ex.unit} → {ex.last}{ex.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className={`text-base font-black ${ex.delta >= 0 ? 'text-[#00FF87]' : 'text-[#FF4757]'}`}>
                        {ex.delta >= 0 ? '+' : ''}{ex.delta}{ex.unit}
                      </p>
                      <p className={`text-xs font-semibold ${ex.delta >= 0 ? 'text-[#00FF87]/60' : 'text-[#FF4757]/60'}`}>
                        {ex.pct >= 0 ? '+' : ''}{ex.pct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(Math.abs(ex.pct), 100)}%`,
                        backgroundColor: ex.delta >= 0 ? '#00FF87' : '#FF4757',
                      }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
