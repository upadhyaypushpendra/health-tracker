import { useState } from 'react'
import { Plus, Smartphone } from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)
  const isAndroid = Capacitor.getPlatform() === 'android'

  const handleAdd = async (widgetId: string) => {
    setAdding(widgetId)
    setError(null)
    const result = await healthSync.pinWidget()
    setAdding(null)
    if (!result.success) {
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
  onAdd,
}: {
  name: string
  description: string
  preview: React.ReactNode
  disabled: boolean
  adding: boolean
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
          className="w-9 h-9 bg-[#00FF87] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {adding ? (
            <div className="w-4 h-4 border-2 border-[#0D0D0D] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus size={18} className="text-[#0D0D0D]" strokeWidth={2.5} />
          )}
        </button>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[10px] font-medium text-[#333333] uppercase tracking-wider mb-2">Preview</p>
        <div className="bg-[#0D0D0D] rounded-xl p-4 flex items-center justify-center">
          {preview}
        </div>
      </div>
    </div>
  )
}

function HealthWidgetPreview() {
  return (
    <div className="w-full max-w-[300px] bg-[#0D0D0D] rounded-2xl p-2.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className="text-[11px] font-bold text-white">Body Sync</p>
        <div className="bg-[#1E3A5F] rounded px-1.5 py-0.5">
          <p className="text-[8px] font-medium text-blue-400">Today</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden">
        {/* Row 1: Water | Steps */}
        <div className="flex items-center divide-x divide-[#2A2A2A]">
          <Section icon="💧" label="1,200/3,000 ml" pct="40%" color="text-blue-400" badgeColor="text-blue-400" />
          <Section icon="🏃" label="4,230/10,000"   pct="42%" color="text-purple-400" badgeColor="text-purple-400" />
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2A2A2A]" />

        {/* Row 2: Meals | Workout */}
        <div className="flex items-center divide-x divide-[#2A2A2A]">
          <Section icon="🍽" label="1,450/2,000 kcal" pct="73%" color="text-orange-400" badgeColor="text-orange-400" />
          <Section icon="💪" label="Done ✓"            pct="3 meals" color="text-green-400" badgeColor="text-green-400" />
        </div>
      </div>

      {/* Button */}
      <div className="mt-2 bg-blue-700 rounded-xl py-2 text-center">
        <p className="text-[10px] font-bold text-white">Drank 1 glass</p>
      </div>
    </div>
  )
}

function Section({
  icon, label, pct, color, badgeColor,
}: {
  icon: string; label: string; pct: string; color: string; badgeColor: string;
}) {
  return (
    <div className="flex-1 flex items-center gap-1.5 px-2.5 py-2.5">
      <span className="text-[13px] shrink-0">{icon}</span>
      <p className={`flex-1 text-[9px] font-medium leading-tight ${color} min-w-0 truncate`}>{label}</p>
      <div className="bg-[#262626] rounded px-1 py-0.5 shrink-0">
        <p className={`text-[8px] font-bold ${badgeColor}`}>{pct}</p>
      </div>
    </div>
  )
}
