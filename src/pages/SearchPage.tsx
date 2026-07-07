import { useState } from 'react'
import { icons } from '@/utils/icons'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import { formatActiveLabel } from '@/utils/showStatusLabel'
import { StatusPickerSheet } from '@/components/StatusPickerSheet'
import type { ShowStatus, SearchResultWithDetails } from '@/types/tvtime'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [pickingShow, setPickingShow] = useState<SearchResultWithDetails | null>(null)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const raw = await tvtimeService.searchShows(value)
    const withDetails = await Promise.all(
      raw.slice(0, 20).map(async (r) => ({ ...r, details: await tvtimeService.getShowDetails(r.id) })),
    )
    setResults(withDetails)
    setLoading(false)
  }

  async function handleAdd(result: SearchResultWithDetails, status: ShowStatus) {
    const episodes = await tvtimeService.fetchAllEpisodes(result.details.id, result.details.seasons)
    await tvtimeWriteService.addShow({
      tmdbId: result.details.id,
      name: result.details.name,
      posterPath: result.details.poster_path,
      backdropPath: result.details.backdrop_path,
      tmdbStatus: result.details.status,
      numberOfSeasons: result.details.number_of_seasons,
      numberOfEpisodes: result.details.number_of_episodes,
      userStatus: status,
      seasons: result.details.seasons,
      episodes,
    })
    setAddedIds((prev) => new Set(prev).add(result.id))
    setPickingShow(null)
  }

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="p-4">
        <div className="flex items-center gap-2 bg-tvtime-700 rounded-lg px-3 py-2">
          <icons.search size={18} className="text-tvtime-300" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar série..."
            className="bg-transparent flex-1 text-tvtime-100 outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-tvtime-300 text-center">Buscando...</p>}

      <ul>
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-tvtime-700">
            {r.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w185${r.poster_path}`}
                alt={r.name}
                className="w-12 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-tvtime-100 font-semibold">{r.name}</p>
              <p className="text-tvtime-300 text-sm">
                {r.details.number_of_seasons} temp. · {r.details.number_of_episodes} eps ·{' '}
                {formatActiveLabel(r.details.status)}
              </p>
            </div>
            <button
              disabled={addedIds.has(r.id)}
              onClick={() => setPickingShow(r)}
              className="text-tvtime-900 bg-tvtime-100 rounded-full px-3 py-1 text-sm font-semibold disabled:opacity-40"
            >
              {addedIds.has(r.id) ? 'Adicionada' : 'Adicionar'}
            </button>
          </li>
        ))}
      </ul>

      {pickingShow && (
        <StatusPickerSheet
          onCancel={() => setPickingShow(null)}
          onSelect={(status) => handleAdd(pickingShow, status)}
        />
      )}
    </div>
  )
}
