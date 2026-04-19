import { lazy, Suspense, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Scale, Trash2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { db, getSettings } from '../db'
import type { BodyMetric } from '../db/types'
import { getTodayString, formatDisplay } from '../utils/dateHelpers'
import { calculateBMI, getBMICategory } from '../utils/calculations'

const BodyTrendChart = lazy(() =>
  import('../components/charts/BodyTrendChart').then(m => ({ default: m.BodyTrendChart }))
)

export default function Body() {
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').reverse().toArray(), [])
  const settings = useLiveQuery(() => getSettings())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ weight: '', height: '', bodyFat: '', date: getTodayString() })

  const latest = metrics?.[0]
  const bmi = latest?.weight && latest?.height ? calculateBMI(latest.weight, latest.height) : null
  const bmiInfo = bmi ? getBMICategory(bmi) : null

  const handleAdd = async () => {
    const height = form.height ? parseFloat(form.height) : settings?.height ?? null
    const weight = form.weight ? parseFloat(form.weight) : null
    const bmiCalc = weight && height ? calculateBMI(weight, height) : null

    const metric: BodyMetric = {
      id: uuid(),
      date: form.date,
      weight,
      height,
      bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : null,
      bmi: bmiCalc,
    }
    await db.bodyMetrics.put(metric)
    setForm({ weight: '', height: '', bodyFat: '', date: getTodayString() })
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await db.bodyMetrics.delete(id)
  }

  const chartData = [...(metrics ?? [])].reverse().slice(-30).map((m) => ({
    date: m.date,
    weight: m.weight,
    bmi: m.bmi,
    bodyFat: m.bodyFat,
  }))

  return (
    <div className="pb-32">
      <PageHeader
        title="Body Metrics"
        subtitle="Weight & composition tracking"
        right={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            Log
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Stats summary */}
        {latest ? (
          <div className="grid grid-cols-3 gap-3">
            <Card border>
              <p className="text-xs text-[#666666] mb-1">Weight</p>
              <p className="text-xl font-black text-white">{latest.weight ?? '—'}</p>
              <p className="text-xs text-[#555555]">kg</p>
              {settings?.currentWeight && latest.weight && (
                <p className="text-[10px] text-[#00FF87] mt-1">
                  {(latest.weight - settings.currentWeight).toFixed(1)} to goal
                </p>
              )}
            </Card>
            <Card border>
              <p className="text-xs text-[#666666] mb-1">BMI</p>
              <p className="text-xl font-black text-white">{bmi ?? '—'}</p>
              {bmiInfo && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: bmiInfo.color }}>
                  {bmiInfo.label}
                </p>
              )}
            </Card>
            <Card border>
              <p className="text-xs text-[#666666] mb-1">Body Fat</p>
              <p className="text-xl font-black text-white">{latest.bodyFat ?? '—'}</p>
              {latest.bodyFat && <p className="text-xs text-[#555555]">%</p>}
            </Card>
          </div>
        ) : (
          <EmptyState
            icon={<Scale size={48} className="text-[#2A2A2A]" />}
            title="No metrics logged"
            description="Start logging your weight and body composition to track your progress over time."
            action={
              <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>
                Log First Entry
              </Button>
            }
          />
        )}

        {/* Chart */}
        {chartData.length >= 2 && (
          <Suspense fallback={<div className="h-44 bg-[#2A2A2A] rounded-2xl animate-pulse" />}>
            <Card border>
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-4">Weight Trend</p>
              <BodyTrendChart data={chartData} goalWeight={settings?.currentWeight ?? null} />
            </Card>
          </Suspense>
        )}

        {/* History list */}
        {metrics && metrics.length > 0 && (
          <>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider">History</p>
            <div className="space-y-2">
              {metrics.slice(0, 20).map((m) => (
                <Card key={m.id} border padding="sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{formatDisplay(m.date)}</p>
                      <p className="text-xs text-[#555555]">
                        {[
                          m.weight && `${m.weight}kg`,
                          m.bmi && `BMI ${m.bmi}`,
                          m.bodyFat && `${m.bodyFat}% BF`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button className="text-[#FF4757]/50 hover:text-[#FF4757] transition-colors" onClick={() => handleDelete(m.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Log Body Metrics">
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Weight"
            type="number"
            suffix="kg"
            placeholder="75.0"
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            autoFocus
          />
          <Input
            label="Height (optional — used for BMI)"
            type="number"
            suffix="cm"
            placeholder={String(settings?.height ?? 175)}
            value={form.height}
            onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
          />
          <Input
            label="Body Fat %"
            type="number"
            suffix="%"
            placeholder="15.0"
            value={form.bodyFat}
            onChange={(e) => setForm((f) => ({ ...f, bodyFat: e.target.value }))}
          />
          {form.weight && (form.height || settings?.height) && (
            <div className="bg-[#0D0D0D] rounded-xl p-3">
              <p className="text-xs text-[#555555] mb-1">Calculated BMI</p>
              {(() => {
                const h = form.height ? parseFloat(form.height) : (settings?.height ?? 0)
                const w = parseFloat(form.weight)
                if (!h || !w) return null
                const b = calculateBMI(w, h)
                const info = getBMICategory(b)
                return (
                  <p className="text-sm font-bold" style={{ color: info.color }}>
                    {b} — {info.label}
                  </p>
                )
              })()}
            </div>
          )}
          <Button fullWidth size="lg" onClick={handleAdd} disabled={!form.weight}>
            Save Entry
          </Button>
        </div>
      </Modal>
    </div>
  )
}
