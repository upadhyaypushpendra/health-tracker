import { Check, ChevronRight, Droplets, Utensils } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { updateSettings } from '../db'

const STEPS = [
  { id: 'welcome', title: 'Welcome to\nBody Sync', subtitle: 'Your personal fitness companion' },
  { id: 'profile', title: 'About You', subtitle: "Let's personalize your experience" },
  { id: 'goals', title: 'Your Goals', subtitle: 'Set daily targets' },
  { id: 'done', title: "You're all set!", subtitle: 'Start tracking your progress' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [height, setHeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [waterGoal, setWaterGoal] = useState('3000')
  const [calorieGoal, setCalorieGoal] = useState('2000')

  const isLast = step === STEPS.length - 1

  const handleNext = async () => {
    if (isLast) {
      await updateSettings({
        name: name.trim() || 'Athlete',
        height: height ? parseFloat(height) : null,
        goalWeight: goalWeight ? parseFloat(goalWeight) : null,
        waterGoal: parseInt(waterGoal) || 3000,
        calorieGoal: parseInt(calorieGoal) || 2000,
        onboardingCompleted: true,
      })
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
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col px-6 py-12 safe-top safe-bottom">
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
      <div className="flex-1 flex flex-col justify-center">
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
                label="Goal Weight"
                type="number"
                placeholder="75"
                suffix="kg"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                hint="Optional — used for trend charts"
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
              <Input
                name="calorie-goal"
                label="Daily Calorie Goal"
                type="number"
                placeholder="2000"
                suffix="kcal"
                value={calorieGoal}
                onChange={(e) => setCalorieGoal(e.target.value)}
                hint="Adjust based on your fitness goal"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-[#00FF87]/10 rounded-3xl flex items-center justify-center mb-8">
              <Check size={40} className="text-[#00FF87]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white mb-2">
                {name ? `Ready, ${name}!` : STEPS[3].title}
              </h1>
              <p className="text-[#A0A0A0]">{STEPS[3].subtitle}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-2xl p-4 space-y-3">
              <SummaryRow label="Water Goal" value={`${parseInt(waterGoal) >= 1000 ? (parseInt(waterGoal) / 1000).toFixed(1) + 'L' : waterGoal + 'ml'}`} />
              <SummaryRow label="Calorie Goal" value={`${calorieGoal} kcal`} />
              {height && <SummaryRow label="Height" value={`${height} cm`} />}
              {goalWeight && <SummaryRow label="Goal Weight" value={`${goalWeight} kg`} />}
            </div>
            <p className="text-xs text-[#555555] text-center">Create your first workout plan from the Dashboard</p>
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
          {isLast ? 'Start Tracking' : step === 0 ? 'Get Started' : 'Continue'}
        </Button>
        {step > 0 && !isLast && (
          <button
            className="w-full text-center text-sm text-[#555555] mt-3 py-2"
            onClick={() => setStep((s) => s - 1)}
          >
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

// Missing import
function Dumbbell({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 4v16M18 4v16M6 9h12M6 15h12M2 7h4M18 7h4M2 17h4M18 17h4" />
    </svg>
  )
}
