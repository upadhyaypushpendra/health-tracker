import type { PlannedExercise, ExerciseUnit } from '../../db/types'

interface PlannedExerciseInputsProps {
  exercise: PlannedExercise
  unit: ExerciseUnit
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1A1A1A] rounded-lg px-2 py-1.5 text-center">
      <p className="text-[10px] text-[#555555] mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export default function PlannedExerciseInputs({ exercise: ex, unit }: PlannedExerciseInputsProps) {
  const showReps = unit !== 'minutes' && unit !== 'meters'
  const showWeight = unit === 'kg' || unit === 'lbs'

  return (
    <div className={`grid gap-2 ${showWeight ? 'grid-cols-4' : showReps ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <Field label="SETS" value={ex.sets} />
      {showReps && <Field label="REPS" value={ex.reps} />}
      {showWeight && <Field label={unit.toUpperCase()} value={ex.weight} />}
      <Field label="REST(s)" value={ex.restSeconds} />
    </div>
  )
}
