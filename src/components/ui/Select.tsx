import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
}

export default function Select({ label, options, error, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`
            w-full bg-[#111111] border rounded-[10px] px-3 py-2.5 pr-8
            text-white text-sm
            outline-none appearance-none transition-all duration-150
            focus:border-[#00FF87] focus:ring-1 focus:ring-[#00FF87]/20
            ${error ? 'border-[#FF4757]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'}
            ${className}
          `}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1A1A1A]">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none"
        />
      </div>
      {error && <p className="text-xs text-[#FF4757]">{error}</p>}
    </div>
  )
}
