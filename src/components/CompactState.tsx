import { useNavigate } from "react-router-dom";

export interface CompactStateProps {
  name: string;
  navigateTo: string;
  isRestDay: boolean;
  percentage: number;
  Icon?: React.ComponentType<any> | null;
  iconColor?: string;
  value?: string | number;
  unit?: string;
}

export function CompactState({
  navigateTo,
  name,
  isRestDay,
  percentage,
  Icon = null,
  iconColor,
  value,
  unit = '',
}: CompactStateProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(navigateTo)}
      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-2.5 text-left active:scale-[0.97] transition-transform"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={iconColor ? { backgroundColor: `${iconColor}1A` } : undefined}
      >
        {Icon && <Icon size={13} style={iconColor ? { color: iconColor } : undefined} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[#666] leading-none mb-1">{name}</p>
        <p className="text-sm font-bold text-white leading-none mb-1.5">
          {isRestDay ? 'Rest Day' : value}
          {unit && <span className="text-[10px] text-[#555] font-normal"> {unit}</span>}
        </p>
        <div className="h-0.5 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percentage}%`, ...(iconColor ? { backgroundColor: iconColor } : {}) }}
          />
        </div>
      </div>
    </button>
  )
}

export default CompactState;