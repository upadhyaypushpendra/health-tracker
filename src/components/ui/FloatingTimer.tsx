import { useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import ProgressRing from './ProgressRing'
import { useTimer } from '../../contexts/TimerContext'

const SIZE = 64

export default function FloatingTimer() {
  const { duration, timeLeft, isRunning, isVisible, hide } = useTimer()
  const [pos, setPos] = useState({ x: (window.innerWidth - SIZE - 20) / 2, y: window.innerHeight - SIZE - 100 })

  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const didDrag = useRef(false)

  if (!isVisible) return null

  const progress = duration > 0 ? (timeLeft / duration) * 100 : 100
  const ringColor = isRunning ? '#FF6B35' : '#00FF87'

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    didDrag.current = false
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDrag.current = true
    if (!didDrag.current) return
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - SIZE, dragState.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - SIZE, dragState.current.origY + dy)),
    })
  }

  const handlePointerUp = () => {
    dragState.current = null
  }

  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, touchAction: 'none' }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'grab', userSelect: 'none', width: SIZE, height: SIZE }}
        className="relative"
      >
        <ProgressRing
          value={progress}
          size={SIZE}
          strokeWidth={10}
          color={ringColor}
          bgColor="#1E1E1E"
        />

        {/* Inner content */}
        <div
          className="absolute rounded-full bg-[#0D0D0D] flex flex-col items-center justify-center"
          style={{ inset: 10 }}
        >
          <Clock size={64} color="#A0A0A0" />
        </div>

        {/* Dismiss */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); hide() }}
          className="absolute -top-2 -right-2 w-4 h-4 bg-[#2A2A2A] border border-[#333] rounded-full flex items-center justify-center"
        >
          <X size={8} color="#666" />
        </button>
      </div>
    </div>
  )
}
