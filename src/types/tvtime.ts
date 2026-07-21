import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

// --- Domain types -----------------------------------------------------

export type ShowStatus = 'watching' | 'finished' | 'dropped'

export interface WatchlistEntry {
  episode_id: string
  show_id: string
  tvmaze_id: number
  name: string
  poster_path: string | null
  season_number: number
  episode_number: number
  episode_name: string | null
  remaining: number
  is_first_ep: boolean
  is_new: boolean
  is_last_ep: boolean
}

export interface Watchlist {
  watch_next: WatchlistEntry[]
  not_seen_in_a_while: WatchlistEntry[]
  want_to_see: WatchlistEntry[]
}

export interface TvmazeSearchResult {
  id: number
  name: string
  poster_path: string | null
  weight: number
}

export interface TvmazeSeason {
  season_number: number
  name: string | null
  episode_count: number
  air_date: string | null
}

export interface TvmazeShowDetails {
  id: number
  name: string
  original_name: string | null
  language: string
  poster_path: string | null
  backdrop_path: string | null
  status: string
  imdb_id: string | null
  number_of_seasons: number
  number_of_episodes: number
  seasons: TvmazeSeason[]
  networks: { name: string }[]
}

export interface TvmazeEpisode {
  episode_number: number
  name: string
  air_date: string | null
  still_path: string | null
  summary: string | null
}

export interface AddShowInput {
  tvmazeId: number
  name: string
  originalName: string | null
  posterPath: string | null
  backdropPath: string | null
  tvmazeStatus: string
  imdbId: string | null
  numberOfSeasons: number
  numberOfEpisodes: number
  userStatus: ShowStatus
  seasons: TvmazeSeason[]
  episodes: (TvmazeEpisode & { season_number: number })[]
  nextAirDate: string | null
}

export interface SearchResultWithDetails extends TvmazeSearchResult {
  details: TvmazeShowDetails
}

// --- Auth context -------------------------------------------------------

export interface AuthContextValue {
  user: User | null
  loading: boolean
}

// --- Component props ------------------------------------------------------

export interface PrivateRouteProps {
  children: ReactNode
}

export interface ShowRowProps {
  entry: WatchlistEntry
  // Performs the write only — ShowRow awaits this to know when to switch from
  // the pending spinner to the confirmed "Watched" banner.
  onWatch: (entry: WatchlistEntry) => Promise<void>
  // Fired once onWatch resolves. Fire-and-forget from ShowRow's side — it tells
  // the parent to refresh and eventually swap this row for the show's next
  // episode, but ShowRow doesn't need to wait for that; it just stays showing
  // the confirmation banner until the parent replaces it.
  onWatched: (entry: WatchlistEntry) => void
}

export interface ShowEpisodeDetail {
  episode_id: string
  episode_number: number
  name: string | null
  air_date: string | null
  watched: boolean
  watched_at: string | null
}

export interface ShowSeasonDetail {
  season_id: string
  season_number: number
  name: string | null
  user_status: ShowStatus | null
  episode_count: number
  watched_count: number
  episodes: ShowEpisodeDetail[]
}

export interface ShowDetail {
  show_id: string
  tvmaze_id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
  user_status: ShowStatus
  tvmaze_status: string
  seasons: ShowSeasonDetail[]
}

export interface EpisodeDetailNavigationState {
  tvmazeId: number
  seasonNumber: number
  episodeNumber: number
}

export interface SeasonAccordionProps {
  season: ShowSeasonDetail
  stillPathLookup: Record<string, string | null>
  posterPath: string | null
  trackable: boolean
  onToggleEpisode: (episodeId: string, currentlyWatched: boolean, seasonNumber: number, episodeNumber: number) => void
  onSelectEpisode: (seasonNumber: number, episodeNumber: number) => void
}

export interface MarkWatchedModalProps {
  onMarkJustThis: () => void
  onMarkAllPrevious: () => void
  onCancel: () => void
}

export interface ToastProps {
  message: string
  variant: 'error' | 'success'
}

export interface SkeletonProps {
  className?: string
}
