import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '@/utils/icons'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import { formatActiveLabel } from '@/utils/showStatusLabel'
import { sortSearchResultsByRelevance } from '@/utils/sortSearchResults'
import { Toast } from '@/components/Toast'
import { useToast } from '@/utils/useToast'
import type { SearchResultWithDetails } from '@/types/tvtime'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set())
  const latestQueryRef = useRef('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast, showToast } = useToast()

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
      setSearchError("Couldn't search. Try again.")
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

  async function handleAdd(result: SearchResultWithDetails) {
    try {
      await tvtimeWriteService.addShowFromDetails(result.details)
      setTrackedIds((prev) => new Set(prev).add(result.id))
    } catch (err) {
      console.error(err)
      showToast("Couldn't add this show.")
    }
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
            placeholder="Search shows..."
            className="bg-transparent flex-1 text-tvtime-100 outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-tvtime-300 text-center">Searching...</p>}

      {searchError && (
        <div className="px-4 py-3 text-center">
          <p className="text-red-400 text-sm mb-2">{searchError}</p>
          <button
            onClick={() => runSearch(query)}
            className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      {showNoResults && <p className="text-tvtime-300 text-center py-4">No results found.</p>}

      <ul>
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-tvtime-700">
            <Link to={`/show/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              {r.poster_path && (
                <img
                  src={r.poster_path}
                  alt={r.name}
                  className="w-12 h-16 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-tvtime-100 font-semibold truncate">{r.details.name}</p>
                <p className="text-tvtime-300 text-sm">
                  {r.details.number_of_seasons} seasons · {r.details.number_of_episodes} eps ·{' '}
                  {formatActiveLabel(r.details.status)}
                </p>
              </div>
            </Link>
            <button
              disabled={trackedIds.has(r.id)}
              onClick={() => handleAdd(r)}
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

      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </div>
  )
}
