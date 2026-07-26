import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { icons } from '@/utils/icons'
import { tvtimeService } from '@/services/tvtimeService'
import { Toast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { MarkWatchedModal } from '@/components/MarkWatchedModal'
import { useToast } from '@/utils/useToast'
import { useEpisodeWatchActions } from '@/utils/useEpisodeWatchActions'
import { stripHtml } from '@/utils/stripHtml'
import { formatDate } from '@/utils/formatDate'
import { ensureShowAdded } from '@/utils/ensureShowAdded'
import { previewEpisodeId } from '@/utils/previewIds'
import type { ShowDetail, TvmazeEpisode, TvmazeShowDetails, ShowEpisodeDetail, EpisodeDetailNavigationState } from '@/types/tvtime'

function isEpisodeDetailState(value: unknown): value is EpisodeDetailNavigationState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.tvmazeId === 'number' && typeof v.seasonNumber === 'number' && typeof v.episodeNumber === 'number'
}

function EpisodeDetailSkeleton() {
  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <Skeleton className="w-full h-48 rounded-none" />
      <div className="px-4 py-4 space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

const LOAD_ERROR_MESSAGE = "Couldn't load this episode."

export function EpisodeDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = isEpisodeDetailState(location.state) ? location.state : null

  const [detail, setDetail] = useState<ShowDetail | null>(null)
  const [tvmazeDetails, setTvmazeDetails] = useState<TvmazeShowDetails | null>(null)
  const [liveEpisode, setLiveEpisode] = useState<(TvmazeEpisode & { season_number: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failedStill, setFailedStill] = useState(false)
  const { toast, showToast } = useToast()

  const refresh = useCallback(async () => {
    if (!state) return
    try {
      const showDetail = await tvtimeService.loadShow(state.tvmazeId)
      setDetail(showDetail)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(LOAD_ERROR_MESSAGE)
    }
  }, [state])

  useEffect(() => {
    if (!state) {
      navigate('/', { replace: true })
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [showDetail, liveDetails, episodes] = await Promise.all([
          tvtimeService.loadShow(state!.tvmazeId),
          tvtimeService.getShowDetails(state!.tvmazeId),
          tvtimeService.fetchEpisodes(state!.tvmazeId),
        ])
        if (cancelled) return
        setDetail(showDetail)
        setTvmazeDetails(liveDetails)
        setLiveEpisode(
          episodes.find(
            (e) => e.season_number === state!.seasonNumber && e.episode_number === state!.episodeNumber,
          ) ?? null,
        )
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(LOAD_ERROR_MESSAGE)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [state, navigate])

  const ensureAdded = useCallback(async () => {
    if (detail) return detail.seasons
    if (!state || !tvmazeDetails) throw new Error('Show details not loaded yet')
    const newDetail = await ensureShowAdded(state.tvmazeId, tvmazeDetails)
    setDetail(newDetail)
    return newDetail.seasons
  }, [detail, tvmazeDetails, state])

  const { pendingMark, cancelPendingMark, handleToggleEpisode, handleMarkJustThis, handleMarkAllPrevious } =
    useEpisodeWatchActions(detail?.seasons, refresh, showToast, ensureAdded)

  if (!state) {
    return null
  }

  if (loading) {
    return <EpisodeDetailSkeleton />
  }

  const season = detail?.seasons.find((s) => s.season_number === state.seasonNumber)
  // Show hasn't been added yet — fall back to a preview episode built from the
  // live TVmaze data so it can still be viewed and (via handleToggleEpisode's
  // add-then-watch flow) marked watched.
  const previewEpisode: ShowEpisodeDetail | null =
    !detail && liveEpisode
      ? {
          episode_id: previewEpisodeId(state.seasonNumber, state.episodeNumber),
          episode_number: state.episodeNumber,
          name: liveEpisode.name,
          air_date: liveEpisode.air_date,
          watched: false,
          watched_at: null,
        }
      : null
  const episode = season?.episodes.find((e) => e.episode_number === state.episodeNumber) ?? previewEpisode
  const posterPath = detail?.poster_path ?? tvmazeDetails?.poster_path ?? null

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-tvtime-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Something went wrong</p>
        <p className="text-tvtime-300 text-sm mb-6">{error ?? 'Episode not found.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Back
        </button>
      </div>
    )
  }

  const stillPath = liveEpisode?.still_path ?? null
  const showStill = stillPath && !failedStill
  const summary = liveEpisode?.summary ? stripHtml(liveEpisode.summary) : ''

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="relative">
        {showStill ? (
          <img
            src={stillPath}
            alt={episode.name ?? ''}
            className="w-full h-48 object-cover"
            onError={() => setFailedStill(true)}
          />
        ) : (
          posterPath && (
            <img src={posterPath} alt="" className="w-full h-48 object-cover opacity-50" />
          )
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-tvtime-900/70 rounded-full p-1"
        >
          <icons.back size={24} className="text-tvtime-100" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="bg-tvtime-800 rounded-lg p-4">
          <h1 className="text-tvtime-100 text-xl font-bold">{episode.name}</h1>
          {episode.air_date && (
            <p className="text-tvtime-300 text-sm flex items-center gap-1 mt-1">
              <icons.tv size={14} />
              {formatDate(episode.air_date)}
            </p>
          )}
          {episode.watched && episode.watched_at && (
            <p className="text-tvtime-300 text-xs flex items-center gap-1 mt-1">
              <icons.eye size={12} />
              {formatDate(episode.watched_at)}
            </p>
          )}
        </div>

        <div className="bg-tvtime-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-tvtime-300 text-sm font-semibold">
            S{state.seasonNumber} | E{episode.episode_number}
          </span>
          <button
            onClick={() =>
              handleToggleEpisode(
                episode.episode_id,
                episode.watched,
                state.seasonNumber,
                episode.episode_number,
              )
            }
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              episode.watched ? 'bg-yellow-500' : 'bg-tvtime-700'
            }`}
          >
            <icons.check size={16} className={episode.watched ? 'text-tvtime-900' : 'text-tvtime-400'} />
          </button>
        </div>

        {summary && (
          <div className="bg-tvtime-800 rounded-lg p-4">
            <p className="text-tvtime-300 text-sm leading-relaxed">{summary}</p>
          </div>
        )}
      </div>

      {pendingMark && (
        <MarkWatchedModal
          onCancel={cancelPendingMark}
          onMarkJustThis={handleMarkJustThis}
          onMarkAllPrevious={handleMarkAllPrevious}
        />
      )}
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </div>
  )
}
