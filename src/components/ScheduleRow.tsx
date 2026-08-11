import { Link } from 'react-router-dom'
import { formatTime } from '@/utils/formatTime'
import { formatShortDate } from '@/utils/formatShortDate'
import type { ScheduleRowProps } from '@/types/tvtime'

export function ScheduleRow({ entry, showDate }: ScheduleRowProps) {
  return (
    <Link
      to={`/show/${entry.tvmaze_id}`}
      className="mx-3 mb-3 rounded-2xl overflow-hidden bg-tvtime-800 flex"
    >
      {entry.poster_path && (
        <img
          src={entry.poster_path}
          alt={entry.name}
          className="w-24 self-stretch object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 p-4 flex flex-col justify-center gap-1.5">
        <span className="inline-flex items-center self-start rounded-full border border-tvtime-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tvtime-100">
          {entry.name}
        </span>
        <p className="text-tvtime-100 font-bold">
          S{entry.season_number} | E{entry.episode_number}
        </p>
        <p className="text-tvtime-100 truncate">{entry.episode_name}</p>
      </div>
      {(entry.airstamp || showDate) && (
        <div className="flex flex-col items-center justify-center pr-4 gap-0.5 shrink-0">
          {showDate && <span className="text-tvtime-400 text-xs font-semibold">{formatShortDate(entry.air_date)}</span>}
          {entry.airstamp && <span className="text-tvtime-100 text-sm font-semibold">{formatTime(entry.airstamp)}</span>}
        </div>
      )}
    </Link>
  )
}
