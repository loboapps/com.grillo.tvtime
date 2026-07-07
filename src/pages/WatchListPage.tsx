import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShowRow } from '@/components/ShowRow'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import type { Watchlist, WatchlistEntry } from '@/types/tvtime'

const SECTION_LABELS: Record<keyof Watchlist, string> = {
  watch_next: 'WATCH NEXT',
  not_seen_in_a_while: 'NOT SEEN IN A WHILE',
  want_to_see: 'WANT TO SEE',
}

async function syncStaleShows(): Promise<void> {
  const staleIds = await tvtimeService.loadStaleShowIds()
  await Promise.all(
    staleIds.map(async (tmdbId) => {
      const details = await tvtimeService.getShowDetails(tmdbId)
      const episodes = await tvtimeService.fetchAllEpisodes(tmdbId, details.seasons)
      await tvtimeWriteService.syncShow(
        tmdbId,
        details.status,
        details.number_of_seasons,
        details.number_of_episodes,
        details.seasons,
        episodes,
      )
    }),
  )
}

export function WatchListPage() {
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null)

  const reload = useCallback(async () => {
    await syncStaleShows()
    const data = await tvtimeService.loadWatchlist()
    setWatchlist(data)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleWatch(entry: WatchlistEntry) {
    await tvtimeWriteService.watchEpisode(entry.episode_id)
    await reload()
  }

  if (!watchlist) {
    return <div className="min-h-screen bg-tvtime-900" />
  }

  const isEmpty =
    watchlist.watch_next.length === 0 &&
    watchlist.not_seen_in_a_while.length === 0 &&
    watchlist.want_to_see.length === 0

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-tvtime-900 pb-20 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Nenhuma série ainda</p>
        <p className="text-tvtime-300 text-sm mb-6">Adicione séries que você está vendo ou quer ver.</p>
        <Link to="/search" className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold">
          Adicionar série
        </Link>
      </div>
    )
  }

  const sections: (keyof Watchlist)[] = ['watch_next', 'not_seen_in_a_while', 'want_to_see']

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="sticky top-0 z-10 bg-tvtime-900 py-3 flex justify-center">
        <span className="bg-tvtime-700 text-tvtime-100 text-sm font-semibold px-4 py-2 rounded-full">
          WATCH NEXT
        </span>
      </div>
      {sections.map((key) => (
        <section key={key}>
          <h2 className="text-tvtime-300 text-xs font-bold px-4 py-2">{SECTION_LABELS[key]}</h2>
          {watchlist[key].map((entry) => (
            <ShowRow key={entry.episode_id} entry={entry} onWatch={handleWatch} />
          ))}
        </section>
      ))}
    </div>
  )
}
