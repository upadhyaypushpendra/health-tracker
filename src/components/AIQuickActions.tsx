import { Sparkles, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Card from "./ui/Card";

// Full class strings must be written statically — Tailwind purges dynamic interpolations
const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  green: { border: 'border-green-400/40', bg: 'bg-green-400/10', text: 'text-green-400' },
  orange:   { border: 'border-orange-400/40',   bg: 'bg-orange-400/10',   text: 'text-orange-400'   },
}

interface QuickActionCardProps {
  to: string;
  title: string;
  subtitle: string;
  color: keyof typeof COLOR_CLASSES;
  Icon: React.ReactNode;
}

function QuickActionCard({ to, title, subtitle, color, Icon }: QuickActionCardProps) {
  const navigate = useNavigate()
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.green

  return (
    <Card padding="md" hover border className={cls.border} onClick={() => navigate(to)}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${cls.bg} rounded-xl flex items-center justify-center shrink-0`}>
          <span className={cls.text}>{Icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-[#555555]">{subtitle}</p>
        </div>
      </div>
    </Card>
  );
}

export function AIQuickActions() {
  return (
    <div className="mb-4">
      <p className="text-xs text-[#666666] uppercase tracking-wider font-semibold mb-3">AI Assistant</p>
      <div className="grid grid-cols-2 gap-3">
        <QuickActionCard
          to="/ai?mode=feedback"
          title="AI Coach"
          subtitle="Analyze your progress"
          color="green"
          Icon={<Sparkles size={18} />}
        />
        <QuickActionCard
          to="/ai?mode=plan"
          title="AI Planner"
          subtitle="Plan your workouts"
          color="orange"
          Icon={<Wand2 size={18} />}
        />
      </div>
    </div>
  )
}

export default AIQuickActions;
