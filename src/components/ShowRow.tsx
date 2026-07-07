import { useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ShowRowProps } from '@/types/tvtime'

const SWIPE_THRESHOLD = 80

export function ShowRow({ entry, onWatch }: ShowRowProps) {
  const [dragX, setDragX] = useState(0)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX
    dragging.current = true
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current === null) return
    const delta = e.clientX - startX.current
    setDragX(Math.max(0, delta))
  }

  function handlePointerUp() {
    dragging.current = false
    if (dragX >= SWIPE_THRESHOLD) {
      onWatch(entry)
    }
    setDragX(0)
    startX.current = null
  }

  return (
    <div className="relative overflow-hidden border-b border-tvtime-700">
      <div className="absolute inset-0 bg-green-600 flex items-center px-4 text-white font-semibold">
        Visto
      </div>
      <div
        className="relative flex gap-3 px-4 py-3 bg-tvtime-900"
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {entry.poster_path && (
          <img
            src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`}
            alt={entry.name}
            className="w-16 h-24 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <Link to={`/show/${entry.tmdb_id}`} className="text-tvtime-100 font-semibold truncate block">
            {entry.name}
          </Link>
          <p className="text-tvtime-300 text-xs">
            S{entry.season_number} | E{entry.episode_number}
            {entry.remaining > 0 && ` +${entry.remaining}`}
          </p>
          <p className="text-tvtime-100 text-sm truncate">{entry.episode_name}</p>
          <div className="flex gap-1 mt-1">
            {entry.is_first_ep && (
              <span className="text-[10px] bg-tvtime-600 text-tvtime-100 px-2 py-0.5 rounded-full">1st EP</span>
            )}
            {entry.is_new && (
              <span className="text-[10px] bg-yellow-500 text-tvtime-900 px-2 py-0.5 rounded-full">NEW</span>
            )}
            {entry.is_last_ep && (
              <span className="text-[10px] bg-tvtime-600 text-tvtime-100 px-2 py-0.5 rounded-full">Last EP</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
