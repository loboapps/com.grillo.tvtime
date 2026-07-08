import { useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '@/utils/icons'
import type { ShowRowProps } from '@/types/tvtime'

type MarkStatus = 'idle' | 'pending' | 'confirmed'

export function ShowRow({ entry, onWatch, onWatched }: ShowRowProps) {
  const [status, setStatus] = useState<MarkStatus>('idle')

  async function handleMark() {
    if (status !== 'idle') return
    setStatus('pending')
    try {
      await onWatch(entry)
      setStatus('confirmed')
      onWatched(entry)
    } catch {
      // onWatch already surfaced a toast — just let the row go back to normal
      // so the episode isn't stuck showing a pending/confirmed state that
      // never actually happened.
      setStatus('idle')
    }
  }

  if (status === 'confirmed') {
    return (
      <div className="mx-3 mb-3 rounded-2xl overflow-hidden min-h-32 flex items-center gap-2 px-4 bg-green-600 text-white font-semibold">
        <icons.check size={20} />
        Watched
      </div>
    )
  }

  return (
    <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-tvtime-800 flex">
      {entry.poster_path && (
        <img
          src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`}
          alt={entry.name}
          className="w-24 self-stretch object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 p-4 flex flex-col justify-center gap-1.5">
        <Link
          to={`/show/${entry.tmdb_id}`}
          className="inline-flex items-center gap-0.5 self-start rounded-full border border-tvtime-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tvtime-100"
        >
          {entry.name}
          <icons.chevronRight size={14} />
        </Link>
        <p className="text-tvtime-100 font-bold">
          S{entry.season_number} | E{entry.episode_number}
          {entry.remaining > 0 && ` +${entry.remaining}`}
        </p>
        <p className="text-tvtime-100 truncate">{entry.episode_name}</p>
        <div className="flex gap-1.5 mt-0.5">
          {entry.is_first_ep && (
            <span className="text-xs font-bold uppercase tracking-wide bg-tvtime-100 text-tvtime-900 px-3 py-1 rounded-full">
              Premiere
            </span>
          )}
          {entry.is_new && (
            <span className="text-xs font-bold uppercase tracking-wide bg-yellow-500 text-tvtime-900 px-3 py-1 rounded-full">
              New
            </span>
          )}
          {entry.is_last_ep && (
            <span className="text-xs font-bold uppercase tracking-wide bg-tvtime-600 text-tvtime-100 px-3 py-1 rounded-full">
              Last EP
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center pr-4">
        <button
          onClick={handleMark}
          disabled={status === 'pending'}
          aria-label="Mark as watched"
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-tvtime-100"
        >
          {status === 'pending' ? (
            <icons.spinner size={24} className="text-tvtime-900 animate-spin" />
          ) : (
            <icons.check size={26} className="text-tvtime-900" />
          )}
        </button>
      </div>
    </div>
  )
}
