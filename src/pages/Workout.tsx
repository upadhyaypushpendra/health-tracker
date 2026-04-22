import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Dumbbell, Pencil } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import EmptyState from '../components/ui/EmptyState'
import HealthTips from '../components/ui/HealthTips'
import { useActivePlan } from '../hooks/useActivePlan'
import { useTodayWorkout } from '../hooks/useTodayWorkout'
import { useTimer } from '../contexts/TimerContext'
import { db } from '../db'
import type { WorkoutLog, ExerciseLog, SetLog, ExerciseUnit } from '../db/types'
import { getDayOfWeek, getTodayString, DAY_FULL_LABELS } from '../utils/dateHelpers'
import { pct } from '../utils/calculations'
import { hapticMedium, hapticSuccess } from '../utils/haptics'

export default function Workout() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const todayWorkout = useTodayWorkout()
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const timer = useTimer()

  const todayDOW = getDayOfWeek()
  const todayPlan = activePlan?.weekTemplate.find((d) => d.dayOfWeek === todayDOW)
  const isRestDay = todayPlan?.isRest ?? false

  const planUnitMap = useMemo(() => {
    const map = new Map<string, ExerciseUnit>()
    activePlan?.weekTemplate.forEach(day =>
      day.exercises.forEach(ex => map.set(ex.exerciseId, ex.unit))
    )
    return map
  }, [activePlan])

  // Always keep a ref to the latest workout so the sync effect can read it
  // without needing todayWorkout in its deps (which would cause a feedback loop:
  // sync writes DB → liveQuery fires → todayWorkout changes → effect re-runs).
  const todayWorkoutRef = useRef<WorkoutLog | undefined>(undefined)
  todayWorkoutRef.current = todayWorkout

  // Sync plan edits into an in-progress workout log.
  // Fires only when the plan changes — not on every workout DB write.
  const lastPlanUpdatedAt = useRef<string | undefined>(undefined)
  useEffect(() => {
    const workout = todayWorkoutRef.current
    if (!workout || !activePlan || !todayPlan || isRestDay) return
    if (lastPlanUpdatedAt.current === activePlan.updatedAt) return
    lastPlanUpdatedAt.current = activePlan.updatedAt

    const updatedExercises: ExerciseLog[] = []

    for (const planned of todayPlan.exercises) {
      const existing = workout.exercises.find((e) => e.exerciseId === planned.exerciseId)

      if (existing) {
        // Update target values on uncompleted sets; leave completed sets untouched
        const syncedSets: SetLog[] = existing.sets.map((s) =>
          s.completed
            ? s
            : { ...s, targetReps: planned.reps, targetWeight: planned.weight }
        )
        // If the plan added more sets, append them
        for (let i = existing.sets.length; i < planned.sets; i++) {
          syncedSets.push({
            setNumber: i + 1,
            targetReps: planned.reps,
            actualReps: null,
            targetWeight: planned.weight,
            actualWeight: planned.weight,
            completed: false,
          })
        }
        // If the plan reduced sets, drop uncompleted trailing sets only
        const trimmed = syncedSets.filter((s, i) => i < planned.sets || s.completed)
        updatedExercises.push({ ...existing, name: planned.name, sets: trimmed })
      } else {
        // New exercise added to the plan — append with fresh sets
        updatedExercises.push({
          exerciseId: planned.exerciseId,
          name: planned.name,
          completed: false,
          sets: Array.from({ length: planned.sets }, (_, i) => ({
            setNumber: i + 1,
            targetReps: planned.reps,
            actualReps: null,
            targetWeight: planned.weight,
            actualWeight: planned.weight,
            completed: false,
          })),
        })
      }
    }

    // Keep exercises removed from the plan only if they have completed sets
    for (const ex of workout.exercises) {
      const stillInPlan = todayPlan.exercises.some((p) => p.exerciseId === ex.exerciseId)
      if (!stillInPlan && ex.sets.some((s) => s.completed)) {
        updatedExercises.push(ex)
      }
    }

    const allDone = updatedExercises.every((e) => e.completed)
    db.workoutLogs.put({
      ...workout,
      exercises: updatedExercises,
      completed: allDone,
      ...(allDone && !workout.completedAt ? { completedAt: new Date().toISOString() } : {}),
    })
  }, [activePlan, todayPlan, isRestDay])

  const initTodayWorkout = async () => {
    if (!activePlan || !todayPlan || isRestDay) return
    const exercises: ExerciseLog[] = todayPlan.exercises.map((planned) => ({
      exerciseId: planned.exerciseId,
      name: planned.name,
      completed: false,
      sets: Array.from({ length: planned.sets }, (_, i) => ({
        setNumber: i + 1,
        targetReps: planned.reps,
        actualReps: null,
        targetWeight: planned.weight,
        actualWeight: planned.weight,
        completed: false,
      })),
    }))

    const log: WorkoutLog = {
      id: uuid(),
      date: getTodayString(),
      planId: activePlan.id,
      exercises,
      completed: false,
      startedAt: new Date().toISOString(),
    }
    await db.workoutLogs.put(log)
  }

  const toggleSet = async (exIdx: number, setIdx: number) => {
    if (!todayWorkout) return
    const updated = { ...todayWorkout }
    const set = updated.exercises[exIdx].sets[setIdx]
    const wasCompleted = set.completed
    set.completed = !set.completed
    if (set.completed && set.actualReps === null) {
      set.actualReps = set.targetReps
    }

    // Mark exercise complete if all sets done
    updated.exercises[exIdx].completed = updated.exercises[exIdx].sets.every((s) => s.completed)
    // Mark workout complete if all exercises done
    updated.completed = updated.exercises.every((e) => e.completed)
    if (updated.completed) updated.completedAt = new Date().toISOString()

    await db.workoutLogs.put(updated)

    // Haptic feedback on set completion
    if (!wasCompleted && set.completed) {
      if (updated.completed) {
        hapticSuccess()
      } else {
        hapticMedium()
      }
    }

    // Start rest timer when completing a set (not when un-completing)
    if (!wasCompleted && set.completed) {
      const ex = updated.exercises[exIdx]
      const allSetsComplete = ex.sets.every((s) => s.completed)
      if (!allSetsComplete) {
        const planned = todayPlan?.exercises.find((p) => p.exerciseId === ex.exerciseId)
        const restSecs = planned?.restSeconds ?? 90
        timer.start(restSecs)
      }
    }
  }

  const updateSetValue = async (exIdx: number, setIdx: number, field: 'actualReps' | 'actualWeight', value: number) => {
    if (!todayWorkout) return
    const targetField = field === 'actualReps' ? 'targetReps' : 'targetWeight'
    const updated = { ...todayWorkout }
    updated.exercises[exIdx].sets[setIdx] = {
      ...updated.exercises[exIdx].sets[setIdx],
      [field]: value,
      [targetField]: value,
    }
    await db.workoutLogs.put(updated)
  }

  const completedCount = todayWorkout?.exercises.filter((e) => e.completed).length ?? 0
  const totalCount = todayWorkout?.exercises.length ?? todayPlan?.exercises.length ?? 0
  const progressPct = pct(completedCount, totalCount)

  if (!activePlan) {
    return (
      <div className="pb-24">
        <PageHeader title="Workout" subtitle={DAY_FULL_LABELS[todayDOW]} back />
        <EmptyState
          icon={<Dumbbell size={48} className="text-[#2A2A2A]" />}
          title="No active plan"
          description="Create and activate a workout plan to start logging your exercises."
          action={<Button onClick={() => navigate('/plan')}>Go to Plans</Button>}
        />
      </div>
    )
  }

  if (isRestDay) {
    return (
      <div className="pb-24">
        <PageHeader
          back
          title="Workout"
          subtitle={DAY_FULL_LABELS[todayDOW]}
          right={
            <Button variant="primary" size="sm" icon={<Pencil size={14} />} onClick={() => navigate(`/plan/${activePlan.id}/edit`)}>
              Edit Plan
            </Button>
          }
        />
        <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
          <div className="text-6xl mb-4">😴</div>
          <h2 className="text-xl font-black text-white mb-2">Rest Day</h2>
          <p className="text-[#666666] text-sm max-w-xs mb-8">Recovery is part of the plan. Take it easy today and come back stronger tomorrow.</p>
        </div>
        <HealthTips />
      </div>
    )
  }

  return (
    <div className="pb-32">
      <PageHeader
        title="Today's Workout"
        subtitle={`${activePlan.name} · ${DAY_FULL_LABELS[todayDOW]}`}
        back
        right={
          <Button variant="primary" size="sm" icon={<Pencil size={14} />} onClick={() => navigate(`/plan/${activePlan.id}/edit`)}>
            Edit Plan
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Progress summary */}
        {todayWorkout && (
          <Card border className={todayWorkout.completed ? 'border-[#00FF87]/40 bg-[#0D2A1A]' : ''}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-[#666666] mb-0.5">Progress</p>
                <p className="text-lg font-black text-white">{completedCount}/{totalCount} exercises</p>
              </div>
              {todayWorkout.completed && (
                <div className="flex items-center gap-2 text-[#00FF87]">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-bold">Complete!</span>
                </div>
              )}
            </div>
            <ProgressBar value={progressPct} color="green" height="md" />
          </Card>
        )}

        {/* Start workout */}
        {!todayWorkout && (
          <Button fullWidth size="lg" onClick={initTodayWorkout} icon={<Dumbbell size={18} />}>
            Start Workout
          </Button>
        )}

        {/* Exercise list */}
        {(todayWorkout ? todayWorkout.exercises : todayPlan?.exercises ?? []).map((ex: any, exIdx: number) => {
          const isExerciseLog = 'sets' in ex && ex.sets?.[0] && 'completed' in ex.sets[0]
          const exerciseKey = isExerciseLog ? ex.exerciseId : ex.exerciseId
          const isExpanded = expandedExercise === `${exerciseKey}-${exIdx}`
          const exUnit: ExerciseUnit = isExerciseLog ? (planUnitMap.get(ex.exerciseId) ?? 'kg') : (ex.unit ?? 'kg')
          const isTimeBased = exUnit === 'minutes' || exUnit === 'meters'
          const isBodyweight = exUnit === 'bodyweight'
          const durationColLabel = exUnit === 'minutes' ? 'MINS' : exUnit === 'meters' ? 'METERS' : exUnit.toUpperCase()

          return (
            <Card key={`${exerciseKey}-${exIdx}`} border className={isExerciseLog && ex.completed ? 'border-[#00FF87]/20' : ''}>
              <button
                className="w-full flex items-center gap-3 text-left"
                onClick={() => setExpandedExercise(isExpanded ? null : `${exerciseKey}-${exIdx}`)}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isExerciseLog && ex.completed ? 'bg-[#00FF87]/15' : 'bg-[#0D0D0D]'
                  }`}>
                  {isExerciseLog && ex.completed
                    ? <CheckCircle2 size={16} className="text-[#00FF87]" />
                    : <Dumbbell size={16} className="text-[#FF6B35]" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{ex.name}</p>
                  {isExerciseLog ? (
                    <p className="text-xs text-[#555555]">
                      {ex.sets.filter((s: SetLog) => s.completed).length}/{ex.sets.length} sets done
                    </p>
                  ) : (
                    <p className="text-xs text-[#555555]">
                      {isTimeBased
                        ? `${ex.sets} sets · ${ex.weight}${exUnit === 'minutes' ? 'min' : 'm'}`
                        : isBodyweight
                          ? `${ex.sets}×${ex.reps} reps`
                          : `${ex.sets}×${ex.reps} @ ${ex.weight}${exUnit}`}
                    </p>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-[#555555]" /> : <ChevronDown size={16} className="text-[#555555]" />}
              </button>

              {/* Sets */}
              {isExpanded && isExerciseLog && todayWorkout && (
                <div className="mt-4 space-y-2">
                  {/* Header */}
                  <div className={`grid ${isTimeBased || isBodyweight ? 'grid-cols-3' : 'grid-cols-4'} gap-2 px-1`}>
                    <p className="text-[10px] text-[#555555] text-center">SET</p>
                    <p className="text-[10px] text-[#555555] text-center">TARGET</p>
                    {isTimeBased ? (
                      <p className="text-[10px] text-[#555555] text-center">{durationColLabel}</p>
                    ) : isBodyweight ? (
                      <p className="text-[10px] text-[#555555] text-center">REPS</p>
                    ) : (
                      <>
                        <p className="text-[10px] text-[#555555] text-center">REPS</p>
                        <p className="text-[10px] text-[#555555] text-center">WEIGHT</p>
                      </>
                    )}
                  </div>
                  {(ex as ExerciseLog).sets.map((set: SetLog, setIdx: number) => (
                    <div
                      key={setIdx}
                      className={`grid ${isTimeBased || isBodyweight ? 'grid-cols-3' : 'grid-cols-4'} gap-2 items-center p-2 rounded-xl transition-all ${set.completed ? 'bg-[#00FF87]/5' : 'bg-[#0D0D0D]'
                        }`}
                    >
                      <button
                        className="flex items-center justify-center"
                        onClick={() => toggleSet(exIdx, setIdx)}
                      >
                        {set.completed
                          ? <CheckCircle2 size={20} className="text-[#00FF87]" />
                          : <Circle size={20} className="text-[#3A3A3A]" />
                        }
                      </button>
                      <p className="text-xs text-[#666666] text-center">
                        {isTimeBased
                          ? `${set.targetWeight}${exUnit === 'minutes' ? 'min' : 'm'}`
                          : isBodyweight
                            ? `${set.targetReps} reps`
                            : `${set.targetReps}×${set.targetWeight}`}
                      </p>
                      {isTimeBased ? (
                        <input
                          type="number"
                          className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87] w-full"
                          value={set.actualWeight ?? ''}
                          placeholder={String(set.targetWeight)}
                          onChange={(e) => updateSetValue(exIdx, setIdx, 'actualWeight', parseFloat(e.target.value) || 0)}
                        />
                      ) : isBodyweight ? (
                        <input
                          type="number"
                          className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87] w-full"
                          value={set.actualReps ?? ''}
                          placeholder={String(set.targetReps)}
                          onChange={(e) => updateSetValue(exIdx, setIdx, 'actualReps', parseInt(e.target.value) || 0)}
                        />
                      ) : (
                        <>
                          <input
                            type="number"
                            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87] w-full"
                            value={set.actualReps ?? ''}
                            placeholder={String(set.targetReps)}
                            onChange={(e) => updateSetValue(exIdx, setIdx, 'actualReps', parseInt(e.target.value) || 0)}
                          />
                          <input
                            type="number"
                            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87] w-full"
                            value={set.actualWeight ?? ''}
                            placeholder={String(set.targetWeight)}
                            onChange={(e) => updateSetValue(exIdx, setIdx, 'actualWeight', parseFloat(e.target.value) || 0)}
                          />
                        </>
                      )}
                    </div>
                  ))}

                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
