import { useState } from 'react'
import { icons } from '@/utils/icons'
import { formatDate } from '@/utils/formatDate'
import type { SeasonAccordionProps } from '@/types/tvtime'

export function SeasonAccordion({ season, stillPathLookup, posterPath, trackable, onToggleEpisode, onToggleSeason, onSelectEpisode }: SeasonAccordionProps) {
  const [open, setOpen] = useState(false)
  const [failedStills, setFailedStills] = useState<Set<string>>(new Set())
  const fullyWatched = season.watched_count === season.episode_count && season.episode_count > 0
  const progressPct = season.episode_count > 0 ? (season.watched_count / season.episode_count) * 100 : 0

  return (
    <div className="border-b border-tvtime-700">
      <div className="w-full flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <icons.chevronDown
            size={16}
            className={`text-tvtime-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
          <span className="text-tvtime-100 font-semibold truncate">
            Season {season.season_number}
            {season.name ? ` - ${season.name}` : ''}
          </span>
        </button>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-tvtime-300 text-sm">
            {season.watched_count}/{season.episode_count}
          </span>
          <button
            disabled={!trackable}
            onClick={() => onToggleSeason(season.season_id, fullyWatched)}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              fullyWatched ? 'bg-yellow-500' : 'bg-tvtime-700'
            } disabled:opacity-40`}
          >
            <icons.check size={16} className={fullyWatched ? 'text-tvtime-900' : 'text-tvtime-400'} />
          </button>
        </span>
      </div>

      <div className="h-1 bg-tvtime-700">
        <div className="h-full bg-green-500" style={{ width: `${progressPct}%` }} />
      </div>

      {open && (
        <div>
          {season.episodes.map((episode) => {
            const stillPath = stillPathLookup[`${season.season_number}-${episode.episode_number}`]
            const showStill = stillPath && !failedStills.has(episode.episode_id)
            return (
              <div
                key={episode.episode_id}
                onClick={() => onSelectEpisode(season.season_number, episode.episode_number)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-tvtime-800"
              >
                <div className="w-24 h-14 shrink-0 rounded overflow-hidden bg-tvtime-800">
                  {showStill ? (
                    <img
                      src={stillPath}
                      alt={episode.name ?? ''}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedStills((prev) => new Set(prev).add(episode.episode_id))
                      }
                    />
                  ) : (
                    posterPath && (
                      <img
                        src={posterPath}
                        alt=""
                        className="w-full h-full object-cover opacity-50"
                      />
                    )
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-tvtime-300 text-xs">
                    S{season.season_number} | E{episode.episode_number}
                  </p>
                  <p className="text-tvtime-100 text-sm truncate">{episode.name}</p>
                  {episode.watched && episode.watched_at && (
                    <p className="text-tvtime-300 text-xs flex items-center gap-1">
                      <icons.eye size={12} />
                      {formatDate(episode.watched_at)}
                    </p>
                  )}
                </div>
                <button
                  disabled={!trackable}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleEpisode(episode.episode_id, episode.watched, season.season_number, episode.episode_number)
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    episode.watched ? 'bg-yellow-500' : 'bg-tvtime-700'
                  } disabled:opacity-40`}
                >
                  <icons.check size={16} className={episode.watched ? 'text-tvtime-900' : 'text-tvtime-400'} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
