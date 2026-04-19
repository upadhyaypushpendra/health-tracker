import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronRight, Check, Trash2, Upload, Download } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { db, getSettings, updateSettings } from '../db'
import { exportPlan, importPlan } from '../utils/exportImport'

export default function Plan() {
  const navigate = useNavigate()
  const plans = useLiveQuery(() => db.plans.toArray(), [])
  const settings = useLiveQuery(() => getSettings())

  const activePlanId = settings?.activePlanId

  const handleActivate = async (id: string) => {
    await updateSettings({ activePlanId: id })
    await db.plans.toCollection().modify({ isActive: false })
    await db.plans.update(id, { isActive: true })
  }

  const handleDeactivate = async () => {
    await updateSettings({ activePlanId: null })
    await db.plans.toCollection().modify({ isActive: false })
  }

  const handleDelete = async (id: string) => {
    await db.plans.delete(id)
    if (activePlanId === id) {
      await updateSettings({ activePlanId: null })
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const result = await importPlan(file)
      if (!result.success) alert(result.error)
    }
    input.click()
  }

  return (
    <div className="pb-24">
      <PageHeader
        back
        title="Workout Plans"
        subtitle={`${plans?.length ?? 0} plan${plans?.length !== 1 ? 's' : ''}`}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Upload size={14} />} onClick={handleImport}>
              Import
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/plan/new')}>
              New
            </Button>
          </div>
        }
      />

      <div className="px-4 space-y-3">
        {!plans?.length ? (
          <EmptyState
            icon={<span className="text-5xl">📋</span>}
            title="No plans yet"
            description="Create a weekly workout plan with exercises, calorie targets, and water goals."
            action={
              <Button icon={<Plus size={16} />} onClick={() => navigate('/plan/new')}>
                Create First Plan
              </Button>
            }
          />
        ) : (
          plans.map((plan) => {
            const isActive = plan.id === activePlanId
            const restDays = plan.weekTemplate.filter((d) => d.isRest).length
            const workoutDays = 7 - restDays

            return (
              <Card key={plan.id} border className={isActive ? 'border-[#00FF87]/40' : ''}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#00FF87]/15' : 'bg-[#0D0D0D]'}`}>
                    {isActive ? (
                      <Check size={18} className="text-[#00FF87]" />
                    ) : (
                      <span className="text-lg">💪</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white truncate">{plan.name}</p>
                      {isActive && (
                        <span className="text-[10px] bg-[#00FF87]/15 text-[#00FF87] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#666666]">
                      {workoutDays} workout days · {plan.calorieGoal} kcal target
                    </p>
                    <div className="flex gap-1 mt-2">
                      {plan.weekTemplate.map((day, i) => (
                        <div
                          key={i}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${day.isRest
                              ? 'bg-[#2A2A2A] text-[#555555]'
                              : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                            }`}
                        >
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.dayOfWeek]}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {!isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => handleActivate(plan.id)}
                    >
                      Set Active
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      fullWidth
                      onClick={handleDeactivate}
                    >
                      Unset Active
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    icon={<ChevronRight size={14} />}
                    onClick={() => navigate(`/plan/${plan.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Download size={14} />}
                    onClick={() => exportPlan(plan.id)}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDelete(plan.id)}
                  />
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
