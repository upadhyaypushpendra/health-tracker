import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import { db } from '../db'
import type { Plan, DayPlan, PlannedExercise, MuscleGroup, WeightUnit, Exercise } from '../db/types'
import { DAY_FULL_LABELS } from '../utils/dateHelpers'

const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body']
const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
  legs: 'Legs', core: 'Core', cardio: 'Cardio', full_body: 'Full Body',
}

const UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lbs', label: 'lbs' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'meters', label: 'Meters' },
]

const MUSCLE_SELECT_OPTIONS = MUSCLE_GROUPS.map((g) => ({ value: g, label: MUSCLE_LABELS[g] }))

const EMPTY_NEW_EXERCISE = {
  name: '', muscleGroup: 'chest' as MuscleGroup, unit: 'kg' as WeightUnit,
  defaultSets: '3', defaultReps: '10', defaultWeight: '0',
}

function makeEmptyWeek(): DayPlan[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dayOfWeek: d as DayPlan['dayOfWeek'],
    isRest: d === 0 || d === 6,
    exercises: [],
  }))
}

export default function PlanBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const existingPlan = useLiveQuery(() => (id ? db.plans.get(id) : undefined), [id])
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [])

  const [name, setName] = useState('')
  const [calorieTarget, setCalorieTarget] = useState('2000')
  const [waterTarget, setWaterTarget] = useState('3000')
  const [weekTemplate, setWeekTemplate] = useState<DayPlan[]>(makeEmptyWeek())
  const [expandedDay, setExpandedDay] = useState<number | null>(1) // Monday expanded by default
  const [showExercisePicker, setShowExercisePicker] = useState<number | null>(null) // dayOfWeek
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null) // exercise index to replace (null = append)
  const [exerciseFilter, setExerciseFilter] = useState<MuscleGroup | 'all'>('all')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newExercise, setNewExercise] = useState(EMPTY_NEW_EXERCISE)
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existingPlan) {
      setName(existingPlan.name)
      setCalorieTarget(String(existingPlan.calorieTarget))
      setWaterTarget(String(existingPlan.waterTarget))
      setWeekTemplate(existingPlan.weekTemplate)
    }
  }, [existingPlan])

  const toggleRest = (dayOfWeek: number) => {
    setWeekTemplate((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, isRest: !d.isRest, exercises: [] } : d,
      ),
    )
  }

  const addExercise = (dayOfWeek: number, exercise: { id: string; name: string; defaultSets: number; defaultReps: number; defaultWeight: number; unit: any }) => {
    const planned: PlannedExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.defaultSets,
      reps: exercise.defaultReps,
      weight: exercise.defaultWeight,
      unit: exercise.unit,
      restSeconds: 90,
    }
    setWeekTemplate((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d
        if (replaceIndex !== null) {
          // Preserve existing sets/reps/weight from the exercise being replaced
          const existing = d.exercises[replaceIndex]
          const replaced = { ...planned, sets: existing.sets, reps: existing.reps, weight: existing.weight }
          const updated = [...d.exercises]
          updated[replaceIndex] = replaced
          return { ...d, exercises: updated }
        }
        return { ...d, exercises: [...d.exercises, planned] }
      }),
    )
    setShowExercisePicker(null)
    setReplaceIndex(null)
  }

  const openReplace = (dayOfWeek: number, idx: number) => {
    setReplaceIndex(idx)
    setShowExercisePicker(dayOfWeek)
    setExerciseSearch('')
    setExerciseFilter('all')
    setShowCreateForm(false)
  }

  const removeExercise = (dayOfWeek: number, idx: number) => {
    setWeekTemplate((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, exercises: d.exercises.filter((_, i) => i !== idx) }
          : d,
      ),
    )
  }

  const updateExercise = (dayOfWeek: number, idx: number, patch: Partial<PlannedExercise>) => {
    setWeekTemplate((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, exercises: d.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) }
          : d,
      ),
    )
  }

  const handleCreateExercise = async () => {
    if (!newExercise.name.trim()) { setCreateError('Name is required'); return }
    const duplicate = allExercises?.some(
      (e) => e.name.toLowerCase() === newExercise.name.trim().toLowerCase()
    )
    if (duplicate) { setCreateError('An exercise with this name already exists'); return }

    const exercise: Exercise = {
      id: uuid(),
      name: newExercise.name.trim(),
      muscleGroup: newExercise.muscleGroup,
      unit: newExercise.unit,
      defaultSets: parseInt(newExercise.defaultSets) || 3,
      defaultReps: parseInt(newExercise.defaultReps) || 10,
      defaultWeight: parseFloat(newExercise.defaultWeight) || 0,
      isCustom: true,
    }
    await db.exercises.put(exercise)

    // Immediately add to the current day
    if (showExercisePicker !== null) {
      addExercise(showExercisePicker, exercise)
    }

    setNewExercise(EMPTY_NEW_EXERCISE)
    setCreateError('')
    setShowCreateForm(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const plan: Plan = {
        id: id ?? uuid(),
        name: name.trim(),
        calorieTarget: parseInt(calorieTarget) || 2000,
        waterTarget: parseInt(waterTarget) || 3000,
        weekTemplate,
        isActive: existingPlan?.isActive ?? false,
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
      }
      await db.plans.put(plan)
      navigate('/plan')
    } finally {
      setSaving(false)
    }
  }

  const filteredExercises = allExercises?.filter((e) => {
    const matchesMuscle = exerciseFilter === 'all' || e.muscleGroup === exerciseFilter
    const matchesSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
    return matchesMuscle && matchesSearch
  })

  return (
    <div className="pb-32">
      <PageHeader
        title={isEdit ? 'Edit Plan' : 'New Plan'}
        back="/plan"
        right={
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save Plan'}
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Plan details */}
        <Card border>
          <div className="space-y-4">
            <Input
              label="Plan Name"
              placeholder="e.g. Push Pull Legs, 5x5 Strength"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!isEdit}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Calorie Target"
                type="number"
                suffix="kcal"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
              />
              <Input
                label="Water Target"
                type="number"
                suffix="ml"
                value={waterTarget}
                onChange={(e) => setWaterTarget(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Weekly template */}
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider">Weekly Template</p>

        {weekTemplate.map((day) => {
          const isExpanded = expandedDay === day.dayOfWeek

          return (
            <Card key={day.dayOfWeek} border className={day.isRest ? 'opacity-60' : ''}>
              {/* Day header */}
              <div
                className="w-full flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedDay(isExpanded ? null : day.dayOfWeek)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    day.isRest ? 'bg-[#2A2A2A] text-[#555555]' : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  }`}>
                    {DAY_FULL_LABELS[day.dayOfWeek].slice(0, 3)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{DAY_FULL_LABELS[day.dayOfWeek]}</p>
                    <p className="text-xs text-[#555555]">
                      {day.isRest ? 'Rest Day' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                      day.isRest
                        ? 'border-[#3A3A3A] text-[#666666]'
                        : 'border-[#00FF87]/30 text-[#00FF87]'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleRest(day.dayOfWeek) }}
                  >
                    {day.isRest ? 'Mark Active' : 'Mark Rest'}
                  </button>
                  {isExpanded ? <ChevronUp size={16} className="text-[#555555]" /> : <ChevronDown size={16} className="text-[#555555]" />}
                </div>
              </div>

              {/* Expanded exercises */}
              {isExpanded && !day.isRest && (
                <div className="mt-4 space-y-3">
                  {day.exercises.map((ex, idx) => (
                    <div key={idx} className="bg-[#0D0D0D] rounded-xl p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white flex-1 truncate">{ex.name}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-[#00FF87] hover:bg-[#00FF87]/10 transition-all"
                            title="Replace exercise"
                            onClick={() => openReplace(day.dayOfWeek, idx)}
                          >
                            <RefreshCw size={13} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-[#FF4757]/60 hover:text-[#FF4757] hover:bg-[#FF4757]/10 transition-all"
                            onClick={() => removeExercise(day.dayOfWeek, idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const exUnit = allExercises?.find(e => e.id === ex.exerciseId)?.unit ?? ex.unit
                        const isTimeBased = exUnit === 'minutes' || exUnit === 'meters'
                        const isBodyweight = exUnit === 'bodyweight'
                        const durationLabel = exUnit === 'minutes' ? 'MINS' : exUnit === 'meters' ? 'METERS' : exUnit.toUpperCase()
                        return (
                          <div className={`grid gap-2 ${isTimeBased || isBodyweight ? 'grid-cols-3' : 'grid-cols-4'}`}>
                            <div>
                              <label className="text-[10px] text-[#555555] block mb-1">SETS</label>
                              <input
                                type="number"
                                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87]"
                                value={ex.sets}
                                onChange={(e) => updateExercise(day.dayOfWeek, idx, { sets: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                            {!isTimeBased && (
                              <div>
                                <label className="text-[10px] text-[#555555] block mb-1">REPS</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87]"
                                  value={ex.reps}
                                  onChange={(e) => updateExercise(day.dayOfWeek, idx, { reps: parseInt(e.target.value) || 1 })}
                                />
                              </div>
                            )}
                            {!isBodyweight && (
                              <div>
                                <label className="text-[10px] text-[#555555] block mb-1">{durationLabel}</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87]"
                                  value={ex.weight}
                                  onChange={(e) => updateExercise(day.dayOfWeek, idx, { weight: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-[10px] text-[#555555] block mb-1">REST(s)</label>
                              <input
                                type="number"
                                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#00FF87]"
                                value={ex.restSeconds}
                                onChange={(e) => updateExercise(day.dayOfWeek, idx, { restSeconds: parseInt(e.target.value) || 30 })}
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    icon={<Plus size={14} />}
                    onClick={() => { setShowExercisePicker(day.dayOfWeek); setExerciseSearch(''); setExerciseFilter('all') }}
                  >
                    Add Exercise
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Exercise Picker Modal */}
      <Modal
        isOpen={showExercisePicker !== null}
        onClose={() => { setShowExercisePicker(null); setReplaceIndex(null); setShowCreateForm(false); setNewExercise(EMPTY_NEW_EXERCISE); setCreateError('') }}
        title={showCreateForm ? 'Create Exercise' : replaceIndex !== null ? 'Replace Exercise' : 'Add Exercise'}
        fullHeight
      >
        {showCreateForm ? (
          /* ── Inline create form ──────────────────────────────────── */
          <div className="space-y-4">
            <button
              className="flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors mb-2"
              onClick={() => { setShowCreateForm(false); setCreateError('') }}
            >
              ← Back to library
            </button>

            <Input
              label="Exercise Name"
              placeholder="e.g. Reverse Curl, Nordic Curl"
              value={newExercise.name}
              onChange={(e) => { setNewExercise((f) => ({ ...f, name: e.target.value })); setCreateError('') }}
              error={createError}
              autoFocus
            />

            <Select
              label="Muscle Group"
              options={MUSCLE_SELECT_OPTIONS}
              value={newExercise.muscleGroup}
              onChange={(e) => setNewExercise((f) => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
            />

            <Select
              label="Unit"
              options={UNIT_OPTIONS}
              value={newExercise.unit}
              onChange={(e) => setNewExercise((f) => ({ ...f, unit: e.target.value as WeightUnit }))}
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Sets"
                type="number"
                placeholder="3"
                value={newExercise.defaultSets}
                onChange={(e) => setNewExercise((f) => ({ ...f, defaultSets: e.target.value }))}
              />
              <Input
                label="Reps"
                type="number"
                placeholder="10"
                value={newExercise.defaultReps}
                onChange={(e) => setNewExercise((f) => ({ ...f, defaultReps: e.target.value }))}
              />
              <Input
                label={newExercise.unit === 'bodyweight' ? 'N/A' : newExercise.unit.toUpperCase()}
                type="number"
                placeholder="0"
                value={newExercise.defaultWeight}
                onChange={(e) => setNewExercise((f) => ({ ...f, defaultWeight: e.target.value }))}
                disabled={newExercise.unit === 'bodyweight'}
              />
            </div>

            <Button fullWidth size="lg" onClick={handleCreateExercise} disabled={!newExercise.name.trim()}>
              Create & Add to Plan
            </Button>
          </div>
        ) : (
          /* ── Exercise picker list ────────────────────────────────── */
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search exercises…"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#444444] outline-none focus:border-[#00FF87]"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              autoFocus
            />

            {/* Muscle group filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {(['all', ...MUSCLE_GROUPS] as const).map((g) => (
                <button
                  key={g}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-all ${
                    exerciseFilter === g
                      ? 'bg-[#00FF87] text-[#0D0D0D] font-bold'
                      : 'bg-[#2A2A2A] text-[#A0A0A0]'
                  }`}
                  onClick={() => setExerciseFilter(g)}
                >
                  {g === 'all' ? 'All' : MUSCLE_LABELS[g]}
                </button>
              ))}
            </div>

            {/* Create new shortcut */}
            <button
              className="w-full flex items-center gap-3 p-3 border border-dashed border-[#3A3A3A] hover:border-[#00FF87]/40 rounded-xl transition-all group"
              onClick={() => {
                setShowCreateForm(true)
                if (exerciseSearch) setNewExercise((f) => ({ ...f, name: exerciseSearch }))
              }}
            >
              <div className="w-8 h-8 bg-[#00FF87]/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#00FF87]/20 transition-all">
                <Plus size={16} className="text-[#00FF87]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#00FF87]">
                  {exerciseSearch ? `Create "${exerciseSearch}"` : 'Create new exercise'}
                </p>
                <p className="text-xs text-[#555555]">Add a custom exercise to your library</p>
              </div>
            </button>

            {/* Exercise list */}
            <div className="space-y-2">
              {filteredExercises?.map((ex) => (
                <button
                  key={ex.id}
                  className="w-full flex items-center justify-between p-3 bg-[#0D0D0D] rounded-xl hover:bg-[#111111] transition-all text-left"
                  onClick={() => showExercisePicker !== null && addExercise(showExercisePicker, ex)}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{ex.name}</p>
                    <p className="text-xs text-[#555555]">
                      {ex.defaultSets}×{ex.defaultReps} · {ex.defaultWeight}{ex.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.isCustom && (
                      <span className="text-[10px] bg-[#FF6B35]/15 text-[#FF6B35] px-2 py-0.5 rounded-md">Custom</span>
                    )}
                    <span className="text-[10px] bg-[#2A2A2A] text-[#A0A0A0] px-2 py-1 rounded-lg capitalize">
                      {MUSCLE_LABELS[ex.muscleGroup]}
                    </span>
                  </div>
                </button>
              ))}

              {filteredExercises?.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[#555555] text-sm mb-3">No exercises found</p>
                  <button
                    className="text-sm text-[#00FF87] font-semibold"
                    onClick={() => {
                      setShowCreateForm(true)
                      if (exerciseSearch) setNewExercise((f) => ({ ...f, name: exerciseSearch }))
                    }}
                  >
                    + Create "{exerciseSearch}"
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
