import { useRef, type ReactNode } from 'react'

interface SwipeToDeleteProps {
  onDelete: () => void
  children: ReactNode
  /** Threshold in px before delete triggers (default 80) */
  threshold?: number
}

/**
 * Wraps children in a swipe-left-to-delete container.
 * A red "Delete" reveal slides in on swipe; releasing past the threshold
 * fires onDelete. Uses pointer events so it works on both touch and mouse.
 */
export default function SwipeToDelete({ onDelete, children, threshold = 80 }: SwipeToDeleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const isDragging = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX
    currentX.current = 0
    isDragging.current = true
    containerRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    const delta = e.clientX - startX.current
    if (delta > 0) return // no swipe right
    currentX.current = delta
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${Math.max(delta, -threshold - 24)}px)`
    }
  }

  const onPointerUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    if (currentX.current <= -threshold) {
      onDelete()
    }
    // snap back
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.2s ease'
      containerRef.current.style.transform = 'translateX(0)'
      setTimeout(() => {
        if (containerRef.current) containerRef.current.style.transition = ''
      }, 200)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-0 flex items-center justify-end bg-[#FF4757] rounded-xl">
        <span className="text-white text-xs font-bold pr-4">Delete</span>
      </div>
      {/* Swipeable content */}
      <div
        ref={containerRef}
        className="relative touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  )
}
