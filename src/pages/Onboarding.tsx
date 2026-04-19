import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, Droplets, Dumbbell as DumbbellIcon, Flame, Utensils } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { db, updateSettings } from '../db'
import type { Plan } from '../db/types'

const STEPS = [
  { id: 'welcome', title: 'Welcome to\nBody Sync', subtitle: 'Your personal fitness companion' },
  { id: 'profile', title: 'About You', subtitle: "Let's personalize your experience" },
  { id: 'goals', title: 'Your Goals', subtitle: 'Set daily targets' },
  { id: 'plan', title: 'Pick a Plan', subtitle: 'Start with a sample or add your own later' },
  { id: 'done', title: "You're all set!", subtitle: 'Start tracking your progress' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null)
  const [height, setHeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [waterGoal, setWaterGoal] = useState('3000')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const plans = useLiveQuery(() => db.plans.toArray(), [])

  const isLast = step === STEPS.length - 1

  const handleNext = async () => {
    if (isLast) {
      await updateSettings({
        name: name.trim() || 'Athlete',
        gender,
        height: height ? parseFloat(height) : null,
        currentWeight: currentWeight ? parseFloat(currentWeight) : null,
        waterGoal: parseInt(waterGoal) || 3000,
        onboardingCompleted: true,
        activePlanId: selectedPlanId,
      })
      if (selectedPlanId) {
        await db.plans.toCollection().modify({ isActive: false })
        await db.plans.update(selectedPlanId, { isActive: true })
      }
      navigate('/', { replace: true })
    } else {
      setStep((s) => s + 1)
    }
  }

  const canProceed = () => {
    if (step === 1 && !name.trim()) return false
    return true
  }

  return (
    <div className="min-h-dvh bg-[#0D0D0D] flex flex-col px-6 py-12 safe-top safe-bottom">
      {/* Step indicators */}
      <div className="flex gap-2 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-[#00FF87]' : 'bg-[#2A2A2A]'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col ${step === 3 ? 'overflow-y-auto' : 'justify-center'}`}>
        {step === 0 && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-[#00FF87]/10 rounded-3xl flex items-center justify-center mb-8">
              <img src="/icon-512.png" alt="Body Sync" className="w-20 h-20" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white whitespace-pre-line leading-tight mb-3">
                {STEPS[0].title}
              </h1>
              <p className="text-[#A0A0A0] text-lg">{STEPS[0].subtitle}</p>
            </div>
            <div className="grid gap-4 mt-8">
              {[
                { icon: Dumbbell, label: 'Track workouts & sets' },
                { icon: Droplets, label: 'Monitor water intake' },
                { icon: Utensils, label: 'Log meals & macros' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-[#A0A0A0]">
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-[#00FF87]" />
                  </div>
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-black text-white mb-2">{STEPS[1].title}</h1>
              <p className="text-[#A0A0A0]">{STEPS[1].subtitle}</p>
            </div>
            <div className="space-y-4">
              <Input
                name="name"
                label="Your Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div>
                <p className="text-xs font-medium text-[#A0A0A0] mb-2">Gender</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        gender === g
                          ? 'bg-[#00FF87] text-[#0D0D0D]'
                          : 'bg-[#1A1A1A] text-[#555555] border border-[#2A2A2A]'
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                name="height"
                label="Height"
                type="number"
                placeholder="175"
                suffix="cm"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <Input
                name="goalWeight"
                label="Current Weight"
                type="number"
                placeholder="75"
                suffix="kg"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                hint="Optional — used for progress tracking"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-black text-white mb-2">{STEPS[2].title}</h1>
              <p className="text-[#A0A0A0]">{STEPS[2].subtitle}</p>
            </div>
            <div className="space-y-4">
              <Input
                name="water-goal"
                label="Daily Water Goal"
                type="number"
                placeholder="3000"
                suffix="ml"
                value={waterGoal}
                onChange={(e) => setWaterGoal(e.target.value)}
                hint="Recommended: 2000–4000ml"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="mb-4">
              <h1 className="text-3xl font-black text-white mb-1">{STEPS[3].title}</h1>
              <p className="text-[#A0A0A0] text-sm">{STEPS[3].subtitle}</p>
            </div>

            {/* Skip option */}
            <button
              onClick={() => setSelectedPlanId(null)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                selectedPlanId === null
                  ? 'border-[#00FF87] bg-[#00FF87]/5'
                  : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <p className="text-sm font-bold text-white">I'll add my own plan later</p>
              <p className="text-xs text-[#555555] mt-0.5">Start fresh and build a custom plan</p>
            </button>

            {/* Sample plans */}
            {plans?.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlanId === plan.id}
                onSelect={() => setSelectedPlanId(plan.id)}
              />
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-[#00FF87]/10 rounded-3xl flex items-center justify-center mb-8">
              <Check size={40} className="text-[#00FF87]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white mb-2">
                {name ? `Ready, ${name}!` : STEPS[4].title}
              </h1>
              <p className="text-[#A0A0A0]">{STEPS[4].subtitle}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-2xl p-4 space-y-3">
              <SummaryRow label="Water Goal" value={`${parseInt(waterGoal) >= 1000 ? (parseInt(waterGoal) / 1000).toFixed(1) + 'L' : waterGoal + 'ml'}`} />
              {height && <SummaryRow label="Height" value={`${height} cm`} />}
              {currentWeight && <SummaryRow label="Current Weight" value={`${currentWeight} kg`} />}
              <SummaryRow
                label="Plan"
                value={selectedPlanId ? (plans?.find((p) => p.id === selectedPlanId)?.name ?? '—') : 'Custom (add later)'}
              />
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8">
        <Button
          fullWidth
          size="lg"
          onClick={handleNext}
          disabled={!canProceed()}
          icon={isLast ? <Check size={18} /> : <ChevronRight size={18} />}
        >
          {isLast ? 'Start Tracking' : step === 0 ? 'Get Started' : step === 3 ? (selectedPlanId ? 'Use This Plan' : 'Skip for Now') : 'Continue'}
        </Button>
        {step > 0 && (
          <button
            className="w-full flex items-center justify-center gap-1 text-sm text-[#555555] mt-3 py-2 hover:text-[#A0A0A0] transition-colors"
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#666666]">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const days = plan.weekTemplate.filter((d) => !d.isRest).length
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        selected ? 'border-[#00FF87] bg-[#00FF87]/5' : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-snug">{plan.name}</p>
          {plan.description && (
            <p className="text-xs text-[#555555] mt-0.5 line-clamp-2">{plan.description}</p>
          )}
        </div>
        {selected && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00FF87] flex items-center justify-center mt-0.5">
            <Check size={12} className="text-[#0D0D0D]" />
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-[#555555]">
          <DumbbellIcon size={10} className="text-[#00FF87]" />
          {days} days/week
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#555555]">
          <Flame size={10} className="text-[#FF6B35]" />
          {plan.calorieGoal} kcal target
        </span>
      </div>
    </button>
  )
}

// Local Dumbbell icon (used in welcome step features list)
function Dumbbell({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 4v16M18 4v16M6 9h12M6 15h12M2 7h4M18 7h4M2 17h4M18 17h4" />
    </svg>
  )
}
