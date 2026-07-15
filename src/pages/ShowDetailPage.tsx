import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { icons } from '@/utils/icons'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import { buildStillPathLookup } from '@/utils/buildStillPathLookup'
import { SeasonAccordion } from '@/components/SeasonAccordion'
import { Toast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { MarkWatchedModal } from '@/components/MarkWatchedModal'
import { useToast } from '@/utils/useToast'
import { hasEarlierUnwatchedEpisode } from '@/utils/hasEarlierUnwatchedEpisode'
import { computeNextAirDate } from '@/utils/computeNextAirDate'
import type { ShowDetail, TvmazeShowDetails } from '@/types/tvtime'

function ShowDetailSkeleton() {
  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <Skeleton className="w-full h-48 rounded-none" />
      <div className="px-4 py-4 space-y-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="px-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

const LOAD_ERROR_MESSAGE = "Couldn't load this show."

export function ShowDetailPage() {
  const { tvmazeId } = useParams<{ tvmazeId: string }>()
  const navigate = useNavigate()
  const id = Number(tvmazeId)

  const [detail, setDetail] = useState<ShowDetail | null>(null)
  const [tvmazeDetails, setTvmazeDetails] = useState<TvmazeShowDetails | null>(null)
  const [stillPathLookup, setStillPathLookup] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingMark, setPendingMark] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { toast, showToast } = useToast()

  const notFound = Number.isNaN(id)

  // Refreshes only our DB-tracked state (seasons/episodes/watched flags), not the
  // live TVmaze fetch or the loading gate — a full load() here would unmount
  // SeasonAccordion (collapsing every open season) and re-fetch TVmaze per season
  // on every single episode toggle.
  const refreshDetail = useCallback(async () => {
    try {
      const showDetail = await tvtimeService.loadShow(id)
      setDetail(showDetail)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(LOAD_ERROR_MESSAGE)
    }
  }, [id])

  const load = useCallback(async () => {
    if (notFound) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [showDetail, liveDetails] = await Promise.all([
        tvtimeService.loadShow(id),
        tvtimeService.getShowDetails(id),
      ])
      const episodes = await tvtimeService.fetchEpisodes(id, liveDetails.language, liveDetails.imdb_id)
      setDetail(showDetail)
      setTvmazeDetails(liveDetails)
      setStillPathLookup(buildStillPathLookup(episodes))
      setError(null)

      // We already fetch live TVmaze details on every visit to a tracked show — piggyback on
      // that to catch a season count mismatch (e.g. a revival) and self-heal silently, instead
      // of waiting for the daily cron or a manual refresh. No extra TVmaze calls: everything
      // needed (seasons/episodes) is already in hand from the fetches above.
      if (showDetail) {
        const storedSeasonCount = showDetail.seasons.filter((s) => s.season_number !== 0).length
        if (storedSeasonCount !== liveDetails.number_of_seasons) {
          tvtimeWriteService
            .syncShow(
              id,
              liveDetails.status,
              liveDetails.imdb_id,
              liveDetails.original_name,
              liveDetails.poster_path,
              liveDetails.backdrop_path,
              liveDetails.number_of_seasons,
              liveDetails.number_of_episodes,
              liveDetails.seasons,
              episodes,
              computeNextAirDate(episodes),
            )
            .then(() => refreshDetail())
            .catch((err) => console.error('Background season-count sync failed:', err))
        }
      }
    } catch (err) {
      console.error(err)
      setError(LOAD_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }, [id, notFound, refreshDetail])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleEpisode(
    episodeId: string,
    currentlyWatched: boolean,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    if (currentlyWatched) {
      try {
        await tvtimeWriteService.unwatchEpisode(episodeId)
        await refreshDetail()
      } catch (err) {
        console.error(err)
        showToast("Couldn't update the episode.")
      }
      return
    }

    if (detail && hasEarlierUnwatchedEpisode(detail.seasons, seasonNumber, episodeNumber)) {
      setPendingMark(episodeId)
      return
    }

    try {
      await tvtimeWriteService.watchEpisode(episodeId)
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episode.")
    }
  }

  async function handleMarkJustThis() {
    if (!pendingMark) return
    try {
      await tvtimeWriteService.watchEpisode(pendingMark)
      setPendingMark(null)
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episode.")
    }
  }

  async function handleMarkAllPrevious() {
    if (!pendingMark) return
    try {
      await tvtimeWriteService.watchEpisode(pendingMark, true)
      setPendingMark(null)
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episodes.")
    }
  }

  async function handleAdd() {
    if (!tvmazeDetails) return
    try {
      await tvtimeWriteService.addShowFromDetails(tvmazeDetails)
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't add this show.")
    }
  }

  async function handleRefresh() {
    if (!detail || refreshing) return
    setRefreshing(true)
    try {
      const liveDetails = await tvtimeService.getShowDetails(id)
      const episodes = await tvtimeService.fetchEpisodes(id, liveDetails.language, liveDetails.imdb_id)
      await tvtimeWriteService.syncShow(
        id,
        liveDetails.status,
        liveDetails.imdb_id,
        liveDetails.original_name,
        liveDetails.poster_path,
        liveDetails.backdrop_path,
        liveDetails.number_of_seasons,
        liveDetails.number_of_episodes,
        liveDetails.seasons,
        episodes,
        computeNextAirDate(episodes),
      )
      setTvmazeDetails(liveDetails)
      setStillPathLookup(buildStillPathLookup(episodes))
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't refresh this show.")
    } finally {
      setRefreshing(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-tvtime-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Show not found</p>
        <button
          onClick={() => navigate('/')}
          className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Back
        </button>
      </div>
    )
  }

  if (loading) {
    return <ShowDetailSkeleton />
  }

  if (error || !tvmazeDetails) {
    return (
      <div className="min-h-screen bg-tvtime-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Something went wrong</p>
        <p className="text-tvtime-300 text-sm mb-6">{error}</p>
        <button
          onClick={() => load()}
          className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    )
  }

  const backdropUrl = tvmazeDetails.backdrop_path
  const network = tvmazeDetails.networks[0]?.name
  const totalEpisodes = detail?.seasons.reduce((sum, s) => sum + s.episode_count, 0) ?? 0
  const totalWatched = detail?.seasons.reduce((sum, s) => sum + s.watched_count, 0) ?? 0
  const overallProgressPct = totalEpisodes > 0 ? (totalWatched / totalEpisodes) * 100 : 0

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="relative">
        {backdropUrl && <img src={backdropUrl} alt={tvmazeDetails.name} className="w-full h-48 object-cover" />}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-tvtime-900/70 rounded-full p-1"
        >
          <icons.back size={24} className="text-tvtime-100" />
        </button>
        {detail && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh show data"
            className="absolute top-4 right-4 bg-tvtime-900/70 rounded-full p-1"
          >
            <icons.refresh size={24} className={`text-tvtime-100 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="px-4 py-4">
        <h1 className="text-tvtime-100 text-xl font-bold">{tvmazeDetails.name}</h1>
        <p className="text-tvtime-300 text-sm mt-1">
          {tvmazeDetails.number_of_seasons} seasons{network ? ` · ${network}` : ''}
        </p>

        {detail && (
          <div className="h-1.5 bg-tvtime-700 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${overallProgressPct}%` }} />
          </div>
        )}

        {!detail && (
          <button
            onClick={() => handleAdd()}
            className="mt-4 bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Add
          </button>
        )}
      </div>

      <h2 className="text-tvtime-300 text-xs font-bold px-4 py-2">EPISODES</h2>

      {detail
        ? detail.seasons.map((season) => (
            <SeasonAccordion
              key={season.season_id}
              season={season}
              stillPathLookup={stillPathLookup}
              posterPath={detail.poster_path}
              trackable
              onToggleEpisode={handleToggleEpisode}
            />
          ))
        : tvmazeDetails.seasons.map((season) => (
            <SeasonAccordion
              key={season.season_number}
              season={{
                season_id: `preview-${season.season_number}`,
                season_number: season.season_number,
                name: season.name,
                user_status: null,
                episode_count: season.episode_count,
                watched_count: 0,
                episodes: [],
              }}
              stillPathLookup={stillPathLookup}
              posterPath={tvmazeDetails.poster_path}
              trackable={false}
              onToggleEpisode={() => {}}
            />
          ))}

      {pendingMark && (
        <MarkWatchedModal
          onCancel={() => setPendingMark(null)}
          onMarkJustThis={handleMarkJustThis}
          onMarkAllPrevious={handleMarkAllPrevious}
        />
      )}
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </div>
  )
}
