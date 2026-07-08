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
import type { ShowDetail, TmdbShowDetails } from '@/types/tvtime'

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
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const navigate = useNavigate()
  const id = Number(tmdbId)

  const [detail, setDetail] = useState<ShowDetail | null>(null)
  const [tmdbDetails, setTmdbDetails] = useState<TmdbShowDetails | null>(null)
  const [stillPathLookup, setStillPathLookup] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingMark, setPendingMark] = useState<string | null>(null)
  const { toast, showToast } = useToast()

  const notFound = Number.isNaN(id)

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
      const episodes = await tvtimeService.fetchAllEpisodes(id, liveDetails.seasons)
      setDetail(showDetail)
      setTmdbDetails(liveDetails)
      setStillPathLookup(buildStillPathLookup(episodes))
      setError(null)
    } catch (err) {
      console.error(err)
      setError(LOAD_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }, [id, notFound])

  // Refreshes only our DB-tracked state (seasons/episodes/watched flags), not the
  // live TMDB fetch or the loading gate — a full load() here would unmount
  // SeasonAccordion (collapsing every open season) and re-fetch TMDB per season
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
    if (!tmdbDetails) return
    try {
      await tvtimeWriteService.addShowFromDetails(tmdbDetails)
      await refreshDetail()
    } catch (err) {
      console.error(err)
      showToast("Couldn't add this show.")
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

  if (error || !tmdbDetails) {
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

  const backdropUrl = tmdbDetails.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${tmdbDetails.backdrop_path}`
    : null
  const network = tmdbDetails.networks[0]?.name

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="relative">
        {backdropUrl && <img src={backdropUrl} alt={tmdbDetails.name} className="w-full h-48 object-cover" />}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-tvtime-900/70 rounded-full p-1"
        >
          <icons.back size={24} className="text-tvtime-100" />
        </button>
      </div>

      <div className="px-4 py-4">
        <h1 className="text-tvtime-100 text-xl font-bold">{tmdbDetails.name}</h1>
        <p className="text-tvtime-300 text-sm mt-1">
          {tmdbDetails.number_of_seasons} seasons{network ? ` · ${network}` : ''}
        </p>

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
              trackable
              onToggleEpisode={handleToggleEpisode}
            />
          ))
        : tmdbDetails.seasons.map((season) => (
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
