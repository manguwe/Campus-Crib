import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * Props:
 * - items: [{ url, media_type: 'image' | 'video' }]
 * - initialIndex: number
 * - onClose(): called when the lightbox should close
 */
export default function Lightbox({ items, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const pinchState = useRef(null) // last two-finger distance, for pinch-to-zoom

  const item = items[index]

  function goTo(nextIndex) {
    setZoom(1)
    setIndex((nextIndex + items.length) % items.length)
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', handleKey)
    // Lock background scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length])

  function handleWheel(e) {
    if (item.media_type === 'video') return
    e.preventDefault()
    setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)))
  }

  function distanceBetween(touches) {
    const [a, b] = touches
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      pinchState.current = distanceBetween(e.touches)
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 2 && pinchState.current) {
      const newDistance = distanceBetween(e.touches)
      const delta = newDistance - pinchState.current
      setZoom((z) => Math.min(4, Math.max(1, z + delta * 0.005)))
      pinchState.current = newDistance
    }
  }

  function handleTouchEnd() {
    pinchState.current = null
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-10">
        <span className="text-white/70 text-sm">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {item.media_type === 'image' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                aria-label="Zoom out"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
                aria-label="Zoom in"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <ZoomIn size={18} />
              </button>
            </>
          )}
          <a
            href={item.url}
            download
            target="_blank"
            rel="noreferrer"
            aria-label="Download"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <Download size={18} />
          </a>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Prev/next arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Media */}
      <div
        className="max-w-[92vw] max-h-[85vh] flex items-center justify-center overflow-hidden touch-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {item.media_type === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            muted
            loop
            playsInline
            className="max-w-[92vw] max-h-[85vh]"
          />
        ) : (
          <img
            src={item.url}
            alt=""
            className="max-w-[92vw] max-h-[85vh] object-contain transition-transform duration-100 select-none"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        )}
      </div>
    </div>
  )
}
