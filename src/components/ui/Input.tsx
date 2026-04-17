import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  suffix?: string
}

export default function Input({ label, hint, error, suffix, className = '', id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          className={`
            w-full bg-[#111111] border rounded-[10px] px-3 py-2.5
            text-white text-sm placeholder:text-[#444444]
            outline-none transition-all duration-150
            focus:border-[#00FF87] focus:ring-1 focus:ring-[#00FF87]/20
            ${error ? 'border-[#FF4757]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'}
            ${suffix ? 'pr-12' : ''}
            ${className}
          `}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-xs text-[#666666] font-medium pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs text-[#555555]">{hint}</p>}
      {error && <p className="text-xs text-[#FF4757]">{error}</p>}
    </div>
  )
}
