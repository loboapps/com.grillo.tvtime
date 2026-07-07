import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { icons } from '@/utils/icons'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import { buildStillPathLookup } from '@/utils/buildStillPathLookup'
import { SeasonAccordion } from '@/components/SeasonAccordion'
import { StatusPickerSheet } from '@/components/StatusPickerSheet'
import type { ShowDetail, ShowStatus, TmdbShowDetails } from '@/types/tvtime'

export function ShowDetailPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const navigate = useNavigate()
  const id = Number(tmdbId)

  const [detail, setDetail] = useState<ShowDetail | null>(null)
  const [tmdbDetails, setTmdbDetails] = useState<TmdbShowDetails | null>(null)
  const [stillPathLookup, setStillPathLookup] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const load = useCallback(async () => {
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
      setError('Não foi possível carregar esta série.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggleEpisode(episodeId: string, currentlyWatched: boolean) {
    if (currentlyWatched) {
      await tvtimeWriteService.unwatchEpisode(episodeId)
    } else {
      await tvtimeWriteService.watchEpisode(episodeId)
    }
    await load()
  }

  async function handleAdd(status: ShowStatus) {
    if (!tmdbDetails) return
    await tvtimeWriteService.addShowFromDetails(tmdbDetails, status)
    setShowPicker(false)
    await load()
  }

  if (loading) {
    return <div className="min-h-screen bg-tvtime-900" />
  }

  if (error || !tmdbDetails) {
    return (
      <div className="min-h-screen bg-tvtime-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Algo deu errado</p>
        <p className="text-tvtime-300 text-sm mb-6">{error}</p>
        <button
          onClick={() => load()}
          className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Tentar novamente
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
          {tmdbDetails.number_of_seasons} temporadas{network ? ` · ${network}` : ''}
        </p>

        {!detail && (
          <button
            onClick={() => setShowPicker(true)}
            className="mt-4 bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Adicionar
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

      {showPicker && (
        <StatusPickerSheet onCancel={() => setShowPicker(false)} onSelect={handleAdd} />
      )}
    </div>
  )
}
