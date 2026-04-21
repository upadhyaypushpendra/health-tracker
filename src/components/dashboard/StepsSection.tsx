import { Footprints } from 'lucide-react'
import Card from '../ui/Card'
import { useSteps } from '../../hooks/useSteps'

const STEP_GOAL = 10000

export default function StepsSection() {
  const { steps, available, connected, loading, connect } = useSteps()

  if (!available || loading) return null

  const progress = steps != null ? Math.min((steps / STEP_GOAL) * 100, 100) : 0

  return (
    <Card border className="mb-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
          <Footprints size={16} className="text-[#60A5FA]" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">Today's Steps</p>
          {connected ? (
            <>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-sm font-bold text-white">{(steps ?? 0).toLocaleString()}</span>
                <span className="text-xs text-[#555555]">/ {STEP_GOAL.toLocaleString()}</span>
              </div>
              <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#60A5FA] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/70">Sync steps from Health Connect</p>
              <button
                onClick={connect}
                className="text-xs font-semibold text-[#000000] bg-[#01ff86] px-3 py-1.5 rounded-lg active:scale-95 transition-transform ml-4"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
