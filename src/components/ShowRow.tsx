import { useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '@/utils/icons'
import type { ShowRowProps } from '@/types/tvtime'

export function ShowRow({ entry, onWatch }: ShowRowProps) {
  const [marking, setMarking] = useState(false)

  function handleMark() {
    if (marking) return
    setMarking(true)
    onWatch(entry)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-tvtime-900 border-b border-tvtime-700">
      {entry.poster_path && (
        <img
          src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`}
          alt={entry.name}
          className="w-16 h-24 object-cover rounded"
        />
      )}
      <Link to={`/show/${entry.tmdb_id}`} className="flex-1 min-w-0">
        <p className="text-tvtime-100 font-semibold truncate">{entry.name}</p>
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
      </Link>
      <button
        onClick={handleMark}
        disabled={marking}
        aria-label="Mark as watched"
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
          marking ? 'bg-green-600 border-green-600' : 'border-tvtime-600'
        }`}
      >
        <icons.check size={18} className={marking ? 'text-white' : 'text-tvtime-600'} />
      </button>
    </div>
  )
}
