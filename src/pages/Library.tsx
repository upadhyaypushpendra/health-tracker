import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Trash2, Pencil } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ExerciseFormModal from '../components/exercise/ExerciseFormModal'
import { db } from '../db'
import type { Exercise, MuscleGroup } from '../db/types'

const MUSCLE_GROUPS: { id: MuscleGroup | 'all'; label: string; emoji: string }[] = [
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

export default function Library() {
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | undefined>(undefined)

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const filtered = exercises?.filter((e) => {
    const matchesMuscle = filter === 'all' || e.muscleGroup === filter
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    return matchesMuscle && matchesSearch
  })

  const handleDelete = async (id: string) => {
    await db.exercises.delete(id)
  }

  const openAdd = () => {
    setEditingExercise(undefined)
    setShowModal(true)
  }

  const openEdit = (ex: Exercise) => {
    setEditingExercise(ex)
    setShowModal(true)
  }

  return (
    <div className="pb-32">
      <PageHeader
        title="Exercise Library"
        subtitle={`${exercises?.length ?? 0} exercises`}
        right={
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
            New
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
          <input
            type="text"
            placeholder="Search exercises…"
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-[#444444] outline-none focus:border-[#00FF87]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Muscle group filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g.id}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all font-medium ${
                filter === g.id
                  ? 'bg-[#00FF87] text-[#0D0D0D]'
                  : 'bg-[#1A1A1A] text-[#A0A0A0] border border-[#2A2A2A]'
              }`}
              onClick={() => setFilter(g.id)}
            >
              <span>{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="space-y-2">
          {filtered?.map((ex) => (
            <Card key={ex.id} border padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{ex.name}</p>
                  <p className="text-xs text-[#555555] mt-0.5">
                    {ex.defaultSets} sets × {ex.defaultReps} reps
                    {ex.unit !== 'bodyweight' && ` @ ${ex.defaultWeight} ${ex.unit}`}
                  </p>
                  {ex.description && (
                    <p className="text-xs text-[#444444] mt-1">{ex.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] bg-[#2A2A2A] text-[#A0A0A0] px-2 py-1 rounded-lg capitalize">
                    {ex.muscleGroup.replace('_', ' ')}
                  </span>
                  {ex.isCustom && (
                    <>
                      <span className="text-[10px] bg-[#FF6B35]/15 text-[#FF6B35] px-2 py-1 rounded-lg">
                        Custom
                      </span>
                      <button
                        className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-[#00FF87] hover:bg-[#00FF87]/10 transition-all"
                        onClick={() => openEdit(ex)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-[#FF4757]/50 hover:text-[#FF4757] hover:bg-[#FF4757]/10 transition-all"
                        onClick={() => handleDelete(ex.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {filtered?.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <p className="text-[#555555] text-sm">No exercises found</p>
              {search && (
                <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openAdd}>
                  Create "{search}"
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <ExerciseFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => setShowModal(false)}
        exercise={editingExercise}
        initialName={editingExercise ? undefined : search}
        submitLabel={editingExercise ? 'Save Changes' : 'Add to Library'}
      />
    </div>
  )
}
