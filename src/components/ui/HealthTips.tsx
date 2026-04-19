import { Lightbulb } from 'lucide-react';
import { useState } from 'react';

const TIPS = [
  { category: 'Recovery', tip: 'Foam rolling for 10–15 minutes helps break up muscle adhesions and speed up recovery.' },
  { category: 'Recovery', tip: 'Cold showers after intense workouts can reduce inflammation and muscle soreness.' },
  { category: 'Recovery', tip: 'Active rest — light walking or stretching — promotes blood flow without taxing your muscles.' },
  { category: 'Sleep', tip: 'Most muscle repair happens during deep sleep. Aim for 7–9 hours tonight.' },
  { category: 'Sleep', tip: 'Keeping a consistent sleep schedule — even on rest days — improves recovery quality.' },
  { category: 'Nutrition', tip: "Prioritise protein on rest days. Your muscles are still rebuilding after yesterday's effort." },
  { category: 'Nutrition', tip: 'Staying hydrated helps flush metabolic waste products produced during exercise.' },
  { category: 'Nutrition', tip: 'Anti-inflammatory foods like berries, leafy greens, and nuts support muscle repair.' },
  { category: 'Mobility', tip: 'Spend 10 minutes on hip flexor and thoracic spine mobility — two areas that tighten quickly from sitting.' },
  { category: 'Mobility', tip: 'Yoga or light stretching on rest days maintains flexibility and reduces injury risk.' },
  { category: 'Mindset', tip: 'Rest days are part of the programme, not a skip. Overtraining without recovery leads to diminishing returns.' },
  { category: 'Mindset', tip: 'Use today to visualise your next session. Mental rehearsal has been shown to improve performance.' },
  { category: 'Recovery', tip: 'Contrast therapy — alternating hot and cold water — accelerates muscle recovery and reduces fatigue.' },
  { category: 'Recovery', tip: 'Elevating your legs for 15 minutes after a hard leg day helps drain lactic acid and reduce swelling.' },
  { category: 'Recovery', tip: 'Compression garments worn after training can reduce delayed onset muscle soreness (DOMS).' },
  { category: 'Recovery', tip: 'Magnesium supplementation supports muscle relaxation and can reduce nighttime cramping.' },
  { category: 'Sleep', tip: 'Avoid screens for at least 30 minutes before bed — blue light suppresses melatonin production.' },
  { category: 'Sleep', tip: "A cooler room (around 18°C / 65°F) signals your body it's time to sleep and improves sleep depth." },
  { category: 'Sleep', tip: 'A short 20-minute nap can restore alertness and support muscle recovery without disrupting night sleep.' },
  { category: 'Nutrition', tip: 'Tart cherry juice contains natural anti-inflammatories that can speed up recovery between sessions.' },
  { category: 'Nutrition', tip: 'Eating a balanced meal within 2 hours of your last workout helps top up glycogen stores.' },
  { category: 'Nutrition', tip: 'Omega-3 fatty acids from fish, flaxseed, or walnuts reduce exercise-induced inflammation.' },
  { category: 'Nutrition', tip: 'Creatine is one of the most researched supplements — it aids recovery and supports next-session strength.' },
  { category: 'Nutrition', tip: 'Collagen peptides taken with vitamin C before bed support connective tissue repair while you sleep.' },
  { category: 'Mobility', tip: 'The 90/90 hip stretch held for 2 minutes per side dramatically improves hip mobility over time.' },
  { category: 'Mobility', tip: 'Daily thoracic rotations reduce upper-back tightness caused by bench pressing and overhead work.' },
  { category: 'Mobility', tip: 'Calf stretching after lower-body days prevents plantar fasciitis and reduces ankle stiffness.' },
  { category: 'Mobility', tip: 'Wrist circles and extension stretches protect against long-term strain from pressing and pulling movements.' },
  { category: 'Mindset', tip: 'Tracking small wins — like a personal best or an extra rep — keeps motivation high over the long term.' },
  { category: 'Mindset', tip: 'Consistency beats intensity. Showing up regularly at moderate effort outperforms sporadic all-out sessions.' },
  { category: 'Mindset', tip: 'Take a moment to appreciate what your body accomplished this week. Gratitude reduces cortisol levels.' },
  { category: 'Mindset', tip: 'Boredom on rest days is normal. Channel it into meal prep, journalling, or planning your next training block.' },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Recovery: { bg: 'bg-[#00FF87]/10', text: 'text-[#00FF87]' },
  Sleep:    { bg: 'bg-[#7C6AF5]/10', text: 'text-[#7C6AF5]' },
  Nutrition:{ bg: 'bg-[#FF6B35]/10', text: 'text-[#FF6B35]' },
  Mobility: { bg: 'bg-[#38BDF8]/10', text: 'text-[#38BDF8]' },
  Mindset:  { bg: 'bg-[#F472B6]/10', text: 'text-[#F472B6]' },
}

function pickTips(count: number) {
  const shuffled = [...TIPS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function HealthTips({ count = 3 }: { count?: number }) {
  const [tips] = useState(() => pickTips(count))

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb size={14} className="text-[#FF6B35]" />
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Rest Day Tips</p>
      </div>
      {tips.map((item, i) => {
        const colors = CATEGORY_COLORS[item.category] ?? { bg: 'bg-[#1A1A1A]', text: 'text-[#A0A0A0]' }
        return (
          <div key={i} className="bg-[#111111] border border-[#1E1E1E] rounded-2xl p-4">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} uppercase tracking-wide`}>
              {item.category}
            </span>
            <p className="mt-2 text-sm text-[#C0C0C0] leading-relaxed">{item.tip}</p>
          </div>
        )
      })}
    </div>
  )
}
