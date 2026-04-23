import { useState } from 'react'
import { Plus, Droplets, Utensils, Dumbbell, Activity, Smartphone } from 'lucide-react'
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
    <div className="w-full max-w-[280px] bg-white rounded-2xl p-3.5 shadow-lg">
      <p className="text-[11px] font-semibold text-gray-800 text-center mb-3">Today's Health</p>

      {/* Water */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
          <Droplets size={12} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-gray-400 leading-none">Water</p>
          <p className="text-[10px] font-medium text-gray-800">1,200 / 3,000 ml</p>
        </div>
        <div className="bg-blue-50 rounded-md px-1.5 py-0.5 shrink-0">
          <p className="text-[9px] text-blue-600 font-semibold">40%</p>
        </div>
      </div>

      {/* Meals */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
          <Utensils size={12} className="text-orange-500" />
        </div>
        <p className="flex-1 text-[10px] text-gray-700">3 meals · 1,450 / 2,000 kcal</p>
      </div>

      {/* Workout */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center shrink-0">
          <Dumbbell size={12} className="text-green-500" />
        </div>
        <p className="flex-1 text-[10px] text-gray-400">No workout today</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-purple-50 rounded-full flex items-center justify-center shrink-0">
          <Activity size={12} className="text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-gray-400 leading-none">Steps</p>
          <p className="text-[10px] font-medium text-gray-800">4,230 / 10,000</p>
        </div>
        <div className="bg-purple-50 rounded-md px-1.5 py-0.5 shrink-0">
          <p className="text-[9px] text-purple-600 font-semibold">42%</p>
        </div>
      </div>

      {/* Log Water button */}
      <div className="bg-blue-600 rounded-lg py-1.5 text-center">
        <p className="text-[10px] font-semibold text-white">Log 250ml Water</p>
      </div>
    </div>
  )
}
