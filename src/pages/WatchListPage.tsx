import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ShowRow } from '@/components/ShowRow'
import { Toast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/utils/useToast'
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
      try {
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
      } catch (err) {
        // One show's TMDB sync failing must never block the rest of the list.
        console.error(`Failed to sync show ${tmdbId}:`, err)
      }
    }),
  )
}

function WatchListSkeleton() {
  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-3 border-b border-tvtime-700">
          <Skeleton className="w-16 h-24" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function WatchListPage() {
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentSection, setCurrentSection] = useState<keyof Watchlist>('watch_next')
  const sectionRefs = useRef<Record<keyof Watchlist, HTMLElement | null>>({
    watch_next: null,
    not_seen_in_a_while: null,
    want_to_see: null,
  })
  const { toast, showToast } = useToast()

  const load = useCallback(async () => {
    try {
      await syncStaleShows()
      const data = await tvtimeService.loadWatchlist()
      setWatchlist(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar sua lista. Verifique sua conexão e tente novamente.')
    }
  }, [])

  // Re-fetches only the watchlist itself, without re-running the TMDB stale-sync —
  // used after marking an episode watched, so one swipe doesn't re-trigger a sync
  // pass across every stale show.
  const refreshWatchlist = useCallback(async () => {
    try {
      const data = await tvtimeService.loadWatchlist()
      setWatchlist(data)
    } catch (err) {
      console.error(err)
      showToast('Não foi possível atualizar a lista.')
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!watchlist) return

    const sections: (keyof Watchlist)[] = ['watch_next', 'not_seen_in_a_while', 'want_to_see']
    const visible = new Map<keyof Watchlist, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.getAttribute('data-section') as keyof Watchlist | null
          if (!key) continue
          if (entry.isIntersecting) {
            visible.set(key, entry.boundingClientRect.top)
          } else {
            visible.delete(key)
          }
        }

        if (visible.size > 0) {
          const topmost = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0]
          setCurrentSection(topmost)
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )

    for (const key of sections) {
      const el = sectionRefs.current[key]
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [watchlist])

  async function handleWatch(entry: WatchlistEntry) {
    try {
      await tvtimeWriteService.watchEpisode(entry.episode_id)
      await refreshWatchlist()
    } catch (err) {
      console.error(err)
      showToast('Não foi possível marcar como visto.')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-tvtime-900 pb-20 flex flex-col items-center justify-center px-6 text-center">
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

  if (!watchlist) {
    return <WatchListSkeleton />
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
          {SECTION_LABELS[currentSection]}
        </span>
      </div>
      {sections.map((key) => (
        <section
          key={key}
          data-section={key}
          ref={(el) => {
            sectionRefs.current[key] = el
          }}
        >
          <h2 className="text-tvtime-300 text-xs font-bold px-4 py-2">{SECTION_LABELS[key]}</h2>
          {watchlist[key].map((entry) => (
            <ShowRow key={entry.episode_id} entry={entry} onWatch={handleWatch} />
          ))}
        </section>
      ))}
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </div>
  )
}
