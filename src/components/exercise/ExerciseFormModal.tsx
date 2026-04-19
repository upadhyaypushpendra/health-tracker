import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import { db } from '../../db'
import type { Exercise, MuscleGroup, ExerciseUnit } from '../../db/types'

export const MUSCLE_GROUPS_WITH_ALL: { id: MuscleGroup | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🏋️' },
  { id: 'chest', label: 'Chest', emoji: '💪' },
  { id: 'back', label: 'Back', emoji: '🔙' },
  { id: 'shoulders', label: 'Shoulders', emoji: '🤸' },
  { id: 'arms', label: 'Arms', emoji: '💪' },
  { id: 'legs', label: 'Legs', emoji: '🦵' },
  { id: 'core', label: 'Core', emoji: '🎯' },
  { id: 'cardio', label: 'Cardio', emoji: '🏃' },
  { id: 'full_body', label: 'Full Body', emoji: '⚡' },
]

export const UNIT_OPTIONS: { value: ExerciseUnit; label: string }[] = [
  { value: 'kg', label: 'kg (weight)' },
  { value: 'lbs', label: 'lbs (weight)' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'minutes', label: 'Minutes (time)' },
  { value: 'meters', label: 'Meters (distance)' },
]

export const MUSCLE_OPTIONS = MUSCLE_GROUPS_WITH_ALL.filter((g) => g.id !== 'all').map((g) => ({
  value: g.id as string,
  label: `${g.emoji} ${g.label}`,
}))

const EMPTY_FORM = {
  name: '',
  muscleGroup: 'chest' as MuscleGroup,
  defaultSets: '3',
  defaultReps: '10',
  defaultWeight: '1',
  unit: 'kg' as ExerciseUnit,
  description: '',
}

function exerciseToForm(ex: Exercise) {
  return {
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    defaultSets: String(ex.defaultSets),
    defaultReps: String(ex.defaultReps),
    defaultWeight: String(ex.defaultWeight),
    unit: ex.unit,
    description: ex.description ?? '',
  }
}

interface ExerciseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (exercise: Exercise) => void
  exercise?: Exercise
  initialName?: string
  submitLabel?: string
}

export default function ExerciseFormModal({
  isOpen,
  onClose,
  onSaved,
  exercise,
  initialName,
  submitLabel,
}: ExerciseFormModalProps) {
  const isEdit = Boolean(exercise)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const allExercises = useLiveQuery(() => db.exercises.toArray(), [])

  useEffect(() => {
    if (!isOpen) return
    if (exercise) {
      setForm(exerciseToForm(exercise))
    } else {
      setForm({ ...EMPTY_FORM, name: initialName ?? '' })
    }
    setError('')
  }, [isOpen, exercise, initialName])

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Exercise name is required')
      return
    }
    const duplicate = allExercises?.some(
      (e) => e.name.toLowerCase() === form.name.trim().toLowerCase() && e.id !== exercise?.id
    )
    if (duplicate) {
      setError('An exercise with this name already exists')
      return
    }

    const saved: Exercise = {
      id: exercise?.id ?? uuid(),
      name: form.name.trim(),
      muscleGroup: form.muscleGroup,
      defaultSets: parseInt(form.defaultSets) || 3,
      defaultReps: parseInt(form.defaultReps) || 10,
      defaultWeight: parseFloat(form.defaultWeight) || 0,
      unit: form.unit,
      isCustom: true,
      description: form.description.trim() || undefined,
    }
    await db.exercises.put(saved)
    onSaved(saved)
  }

  const label = submitLabel ?? (isEdit ? 'Save Changes' : 'Add to Library')
  const title = isEdit ? 'Edit Exercise' : 'New Exercise'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          label="Exercise Name"
          placeholder="e.g. Reverse Curl, Face Pull"
          value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError('') }}
          error={error}
          autoFocus
        />

        <Select
          label="Muscle Group"
          options={MUSCLE_OPTIONS}
          value={form.muscleGroup}
          onChange={(e) => setForm((f) => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
        />

        <Select
          label="Unit"
          options={UNIT_OPTIONS}
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as ExerciseUnit }))}
        />

        {(() => {
          const showReps = form.unit !== 'minutes' && form.unit !== 'meters'
          const showWeight = form.unit !== 'bodyweight';
          const cols = showWeight ? 'grid-cols-3' : showReps ? 'grid-cols-2' : 'grid-cols-1'
          return (
            <div className={`grid ${cols} gap-3`}>
              <Input
                label="Sets"
                type="number"
                placeholder="3"
                value={form.defaultSets}
                onChange={(e) => setForm((f) => ({ ...f, defaultSets: e.target.value }))}
              />
              {showReps && (
                <Input
                  label="Reps"
                  type="number"
                  placeholder="10"
                  value={form.defaultReps}
                  onChange={(e) => setForm((f) => ({ ...f, defaultReps: e.target.value }))}
                />
              )}
              {showWeight && (
                <Input
                  label={form.unit.toUpperCase()}
                  type="number"
                  placeholder="0"
                  value={form.defaultWeight}
                  onChange={(e) => setForm((f) => ({ ...f, defaultWeight: e.target.value }))}
                />
              )}
            </div>
          )
        })()}

        <Input
          label="Description (optional)"
          placeholder="Notes on form, variation, etc."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <Button fullWidth size="lg" onClick={handleSubmit} disabled={!form.name.trim()}>
          {label}
        </Button>
      </div>
    </Modal>
  )
}
