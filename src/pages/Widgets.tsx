import { useState } from 'react'
import { Check, Droplets, Dumbbell, Footprints, Plus, Smartphone, Utensils } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import PageHeader from '../components/layout/PageHeader'
import { healthSync } from '../services/healthSyncPlugin'

interface WidgetDef {
  id: string
  name: string
  description: string
  preview: React.ReactNode
}

export default function Widgets() {
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isAndroid = Capacitor.getPlatform() === 'android'

  const handleAdd = async (widgetId: string) => {
    setAdding(widgetId)
    setAdded(null)
    setError(null)
    const result = await healthSync.pinWidget()
    setAdding(null)
    if (result.success) {
      setAdded(widgetId)
      setTimeout(() => setAdded(null), 5000)
    } else {
      setError(result.message ?? 'Could not add widget.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const widgets: WidgetDef[] = [
    {
      id: 'health',
      name: 'Health Overview',
      description: "Today's water, meals, workout and steps at a glance.",
      preview: <HealthWidgetPreview />,
    },
  ]

  return (
    <div className="pb-32">
      <PageHeader title="Widgets" subtitle="Add widgets to your home screen" back />

      <div className="px-4 space-y-5">
        {!isAndroid && (
          <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3">
            <Smartphone size={15} className="text-[#555555] shrink-0" />
            <p className="text-xs text-[#555555]">Widgets are only available on Android devices.</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-[#FF4757] text-center px-2">{error}</p>
        )}

        <div className="space-y-4">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              name={w.name}
              description={w.description}
              preview={w.preview}
              disabled={!isAndroid}
              adding={adding === w.id}
              added={added === w.id}
              onAdd={() => handleAdd(w.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WidgetCard({
  name,
  description,
  preview,
  disabled,
  adding,
  added,
  onAdd,
}: {
  name: string
  description: string
  preview: React.ReactNode
  disabled: boolean
  adding: boolean
  added: boolean
  onAdd: () => void
}) {
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex-1 pr-3">
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-[#555555] mt-0.5">{description}</p>
        </div>
        <button
          onClick={onAdd}
          disabled={disabled || adding}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            added ? 'bg-[#00FF87]/20 border border-[#00FF87]/40' : 'bg-[#00FF87]'
          }`}
        >
          {adding ? (
            <div className="w-4 h-4 border-2 border-[#0D0D0D] border-t-transparent rounded-full animate-spin" />
          ) : added ? (
            <Check size={18} className="text-[#00FF87]" strokeWidth={2.5} />
          ) : (
            <Plus size={18} className="text-[#0D0D0D]" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {added && (
        <div className="mx-4 mb-3 bg-[#00FF87]/10 border border-[#00FF87]/20 rounded-xl px-3 py-2">
          <p className="text-xs text-[#00FF87]">Widget request sent — check your home screen or long-press to place it.</p>
        </div>
      )}

      <div className="px-4 pb-4">
        <p className="text-[10px] font-medium text-[#333333] uppercase tracking-wider mb-2">Preview</p>
        <div className="bg-[#0D0D0D] rounded-xl p-1 flex items-center justify-center">
          {preview}
        </div>
      </div>
    </div>
  )
}

function HealthWidgetPreview() {
  return (
    <div className="w-full max-w-[300px] bg-[#0D0D0D] rounded-2xl p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] font-bold text-white">Body Sync</p>
        <div className="bg-[#1E3A5F] rounded px-1.5 py-0.5">
          <p className="text-[8px] font-medium text-blue-400">Today</p>
        </div>
      </div>

      {/* Sections grid */}
      <div>
        {/* Row 1: Water | Steps */}
        <div className="flex items-center">
          <Section icon={<Droplets size={13} className="text-blue-400" />} label="1,200/3,000 ml" color="text-blue-400" />
          <div className="w-px self-stretch bg-[#2A2A2A]" />
          <Section icon={<Footprints size={13} className="text-purple-400" />} label="4,230/10,000" color="text-purple-400" />
        </div>

        <div className="h-px bg-[#2A2A2A]" />

        {/* Row 2: Meals | Workout */}
        <div className="flex items-center">
          <Section icon={<Utensils size={13} className="text-orange-400" />} label="1,450/2,000 kcal" color="text-orange-400" />
          <div className="w-px self-stretch bg-[#2A2A2A]" />
          <Section icon={<Dumbbell size={13} className="text-green-400" />} label="Done ✓" color="text-green-400" />
        </div>
      </div>

      {/* Two buttons */}
      <div className="flex gap-1.5 mt-2">
        <div className="flex-1 bg-blue-500 rounded-xl py-1.5 text-center">
          <p className="text-[10px] font-bold text-white">Log Water</p>
        </div>
        <div className="flex-1 bg-orange-500 rounded-xl py-1.5 text-center">
          <p className="text-[10px] font-bold text-white">Log Meal</p>
        </div>
      </div>
    </div>
  )
}

  function Section({
  icon, label, color,
}: {
  icon: React.ReactNode; label: string; color: string
}) {
  return (
    <div className="flex-1 flex items-center gap-1.5 px-2 py-2">
      <span className="shrink-0">{icon}</span>
      <p className={`flex-1 text-[9px] font-medium leading-tight ${color} min-w-0 truncate`}>{label}</p>
    </div>
  )
}
