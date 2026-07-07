import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '@/utils/icons'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import { formatActiveLabel } from '@/utils/showStatusLabel'
import { StatusPickerSheet } from '@/components/StatusPickerSheet'
import { sortSearchResultsByRelevance } from '@/utils/sortSearchResults'
import type { ShowStatus, SearchResultWithDetails } from '@/types/tvtime'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pickingShow, setPickingShow] = useState<SearchResultWithDetails | null>(null)
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set())
  const latestQueryRef = useRef('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    tvtimeService
      .loadTrackedShowIds()
      .then((ids) => setTrackedIds(new Set(ids)))
      .catch((err) => console.error('Failed to load tracked show ids:', err))
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  async function runSearch(value: string) {
    setLoading(true)
    setSearchError(null)
    try {
      const raw = await tvtimeService.searchShows(value)
      const sorted = sortSearchResultsByRelevance(raw, value)
      const withDetails = await Promise.all(
        sorted.slice(0, 20).map(async (r) => ({ ...r, details: await tvtimeService.getShowDetails(r.id) })),
      )
      if (latestQueryRef.current !== value) return
      setResults(withDetails)
    } catch (err) {
      console.error(err)
      if (latestQueryRef.current !== value) return
      setSearchError('Não foi possível buscar. Tente novamente.')
      setResults([])
    } finally {
      if (latestQueryRef.current === value) setLoading(false)
    }
  }

  function handleSearch(value: string) {
    setQuery(value)
    latestQueryRef.current = value

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.trim().length < 2) {
      setResults([])
      setSearchError(null)
      setLoading(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      runSearch(value)
    }, 300)
  }

  async function handleAdd(result: SearchResultWithDetails, status: ShowStatus) {
    await tvtimeWriteService.addShowFromDetails(result.details, status)
    setTrackedIds((prev) => new Set(prev).add(result.id))
    setPickingShow(null)
  }

  const showNoResults = !loading && !searchError && query.trim().length >= 2 && results.length === 0

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

      {searchError && (
        <div className="px-4 py-3 text-center">
          <p className="text-red-400 text-sm mb-2">{searchError}</p>
          <button
            onClick={() => runSearch(query)}
            className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {showNoResults && <p className="text-tvtime-300 text-center py-4">Nenhum resultado encontrado.</p>}

      <ul>
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-tvtime-700">
            <Link to={`/show/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              {r.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w185${r.poster_path}`}
                  alt={r.name}
                  className="w-12 h-16 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-tvtime-100 font-semibold truncate">{r.name}</p>
                <p className="text-tvtime-300 text-sm">
                  {r.details.number_of_seasons} temp. · {r.details.number_of_episodes} eps ·{' '}
                  {formatActiveLabel(r.details.status)}
                </p>
              </div>
            </Link>
            <button
              disabled={trackedIds.has(r.id)}
              onClick={() => setPickingShow(r)}
              className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                trackedIds.has(r.id) ? 'bg-tvtime-700' : 'bg-yellow-500'
              } disabled:opacity-60`}
            >
              {trackedIds.has(r.id) ? (
                <icons.check size={18} className="text-tvtime-300" />
              ) : (
                <icons.plus size={18} className="text-tvtime-900" />
              )}
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
