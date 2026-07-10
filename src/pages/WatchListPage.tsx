import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ShowRow } from '@/components/ShowRow'
import { Toast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/utils/useToast'
import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import type { Watchlist, WatchlistEntry } from '@/types/tvtime'

// How long the row's "Watched" confirmation banner stays up before the row
// swaps to the show's next episode (or disappears, if that was the last one).
const MARK_CONFIRM_MS = 1000

const SECTION_LABELS: Record<keyof Watchlist, string> = {
  watch_next: 'WATCH NEXT',
  not_seen_in_a_while: 'NOT SEEN IN A WHILE',
  want_to_see: 'WANT TO SEE',
}

// `scoped` is the result of tvtime_load_watchlist(showId) — the same 3-bucket
// shape, just containing at most this one show's entry (or nothing, if it's
// now finished/dropped). Splicing it in avoids recomputing every other show.
// The replacement is spliced in at the removed entry's original index (not
// appended) so the row doesn't jump to the end of the section.
function spliceShow(entries: WatchlistEntry[], showId: string, replacement: WatchlistEntry[]): WatchlistEntry[] {
  const index = entries.findIndex((e) => e.show_id === showId)
  if (index === -1) return [...entries, ...replacement]
  const result = [...entries]
  result.splice(index, 1, ...replacement)
  return result
}

function replaceShowInWatchlist(watchlist: Watchlist, showId: string, scoped: Watchlist): Watchlist {
  return {
    watch_next: spliceShow(watchlist.watch_next, showId, scoped.watch_next),
    not_seen_in_a_while: spliceShow(watchlist.not_seen_in_a_while, showId, scoped.not_seen_in_a_while),
    want_to_see: spliceShow(watchlist.want_to_see, showId, scoped.want_to_see),
  }
}

// Syncs exactly the shows passed in — bounded by whatever the caller already
// knows is relevant (currently visible in the watchlist, plus anything whose
// own known next episode air date has arrived), not "every tracked show".
// The daily cron (.github/workflows/app_wrk_sync_shows.yml) has a different
// job: an unconditional whole-library sweep for seasons TMDB hasn't told us
// about yet, which is what sets next_air_date in the first place.
async function syncShows(tmdbIds: number[]): Promise<void> {
  await Promise.all(
    tmdbIds.map(async (tmdbId) => {
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
          details.next_episode_to_air?.air_date ?? null,
        )
      } catch (err) {
        // One show's TMDB sync failing must never block the rest of the list.
        console.error(`Failed to sync show ${tmdbId}:`, err)
      }
    }),
  )
}

function visibleTmdbIds(watchlist: Watchlist): number[] {
  const all = [...watchlist.watch_next, ...watchlist.not_seen_in_a_while, ...watchlist.want_to_see]
  return [...new Set(all.map((e) => e.tmdb_id))]
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
    let data: Watchlist
    try {
      data = await tvtimeService.loadWatchlist()
      setWatchlist(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError("Couldn't load your list. Check your connection and try again.")
      return
    }

    // Show the list immediately with whatever's already in the DB, then sync
    // in the background: shows currently visible, plus any show (regardless
    // of status) whose own known next episode air date has arrived. Bounded
    // by list size + a normally-tiny schedule-due set, never "every tracked
    // show", so this never blocks the page or fires an unbounded burst.
    try {
      const dueIds = await tvtimeService.loadStaleShowIds()
      const toSync = [...new Set([...visibleTmdbIds(data), ...dueIds])]
      await syncShows(toSync)
      const refreshed = await tvtimeService.loadWatchlist()
      setWatchlist(refreshed)
    } catch (err) {
      console.error('Background sync failed:', err)
    }
  }, [])

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

  // ShowRow awaits just the write, so it can show a spinner for exactly the
  // time the server call is actually in flight, then switch to its own
  // "Watched" confirmation banner as soon as this resolves.
  async function handleWatch(entry: WatchlistEntry) {
    try {
      await tvtimeWriteService.watchEpisode(entry.episode_id)
    } catch (err) {
      console.error(err)
      showToast("Couldn't mark as watched.")
      throw err
    }
  }

  // Fired after the write above succeeds. Not awaited by ShowRow — it holds
  // its own confirmation banner until this replaces the row with the show's
  // next episode. Scoped to one show, not a full watchlist reload across
  // every tracked show, which doesn't scale once there are dozens of shows.
  async function handleWatched(entry: WatchlistEntry) {
    try {
      const [scoped] = await Promise.all([
        tvtimeService.loadWatchlist(entry.show_id),
        new Promise((resolve) => setTimeout(resolve, MARK_CONFIRM_MS)),
      ])
      setWatchlist((prev) => (prev ? replaceShowInWatchlist(prev, entry.show_id, scoped) : prev))
    } catch (err) {
      console.error(err)
      showToast("Couldn't refresh the list.")
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-tvtime-900 pb-20 flex flex-col items-center justify-center px-6 text-center">
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
        <p className="text-tvtime-100 font-semibold mb-2">No shows yet</p>
        <p className="text-tvtime-300 text-sm mb-6">Add shows you're watching or want to watch.</p>
        <Link to="/search" className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold">
          Add show
        </Link>
      </div>
    )
  }

  const sections: (keyof Watchlist)[] = ['watch_next', 'not_seen_in_a_while', 'want_to_see']

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      <div className="sticky top-0 z-10 bg-tvtime-900 py-3 flex justify-center">
        <span className="bg-tvtime-600 text-tvtime-100 text-sm font-bold uppercase tracking-wide px-5 py-2.5 rounded-full">
          {SECTION_LABELS[currentSection]}
        </span>
      </div>
      {sections.map((key, index) => (
        <section
          key={key}
          data-section={key}
          ref={(el) => {
            sectionRefs.current[key] = el
          }}
        >
          {index > 0 && watchlist[key].length > 0 && (
            <div className="py-3 flex justify-center">
              <span className="bg-tvtime-600 text-tvtime-100 text-sm font-bold uppercase tracking-wide px-5 py-2.5 rounded-full">
                {SECTION_LABELS[key]}
              </span>
            </div>
          )}
          {watchlist[key].map((entry) => (
            <ShowRow key={entry.episode_id} entry={entry} onWatch={handleWatch} onWatched={handleWatched} />
          ))}
        </section>
      ))}
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </div>
  )
}
