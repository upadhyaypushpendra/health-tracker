import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean | string
  right?: ReactNode
}

export default function PageHeader({ title, subtitle, back, right }: PageHeaderProps) {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLElement>(null)
  const [headerHidden, setHeaderHidden] = useState(false)

  useEffect(() => {
    if (!back) return
    const el = headerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderHidden(!entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [back])

  const handleBack = () => {
    if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }

  return (
    <>
      <header ref={headerRef} className="flex items-center justify-between px-4 pt-12 pb-4 safe-top">
        <div className="flex items-center gap-3">
          {back !== undefined && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-[#A0A0A0] border border-[#333333]"
              aria-label="Go back"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-xs text-[#666666] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
      </header>

      {back !== undefined && (
        <button
          onClick={handleBack}
          aria-label="Go back"
          className={`fixed top-4 left-2 z-50 p-2 rounded-xl text-[#A0A0A0] border border-[#333333] bg-[#0D0D0D]/80 backdrop-blur-sm transition-all duration-200 ${
            headerHidden ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-1'
          }`}
        >
          <ChevronLeft size={22} />
        </button>
      )}
    </>
  )
}
