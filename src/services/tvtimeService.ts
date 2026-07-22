import { supabase } from '@/lib/supabaseClient'
import { computeNextAirDate } from '@/utils/computeNextAirDate'
import type {
  AddShowInput,
  ShowDetail,
  ShowStatus,
  TvmazeSearchResult,
  TvmazeShowDetails,
  TvmazeEpisode,
  Watchlist,
} from '@/types/tvtime'

async function invokeTvmaze<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('tvtime-tvmaze', { body })
  if (error) throw error
  return data as T
}

export const tvtimeService = {
  // Leave showId undefined for the full list. Pass it to scope every bucket to
  // one show only — used to refresh a single row after a write without
  // recomputing the whole watchlist.
  async loadWatchlist(showId?: string): Promise<Watchlist> {
    const { data, error } = await supabase.rpc('tvtime_load_watchlist', { p_show_id: showId ?? null })
    if (error) throw error
    return data as Watchlist
  },

  async loadShow(tvmazeId: number): Promise<ShowDetail | null> {
    const { data, error } = await supabase.rpc('tvtime_load_show', { p_tvmaze_id: tvmazeId })
    if (error) throw error
    return data as ShowDetail | null
  },

  async loadTrackedShowIds(): Promise<number[]> {
    const { data, error } = await supabase.rpc('tvtime_load_tracked_show_ids')
    if (error) throw error
    return data as number[]
  },

  // Schedule-driven, not a blind staleness window: only shows whose own known
  // next episode air date has actually arrived, regardless of status.
  async loadStaleShowIds(): Promise<number[]> {
    const { data, error } = await supabase.rpc('tvtime_load_stale_shows')
    if (error) throw error
    return data as number[]
  },

  async searchShows(query: string): Promise<TvmazeSearchResult[]> {
    const data = await invokeTvmaze<{ results: TvmazeSearchResult[] }>({ action: 'search', query })
    return data.results
  },

  async getShowDetails(tvmazeId: number): Promise<TvmazeShowDetails> {
    return invokeTvmaze<TvmazeShowDetails>({ action: 'show', id: tvmazeId })
  },

  // Whole show, one call — TVmaze's episodes endpoint isn't paginated, unlike
  // TMDB's per-season endpoint this replaces. Includes season 0 (specials) —
  // they're stored like any other episode; any filtering for display purposes
  // happens in the UI, not at the data layer.
  async fetchEpisodes(
    tvmazeId: number,
    language?: string,
    imdbId?: string | null,
  ): Promise<(TvmazeEpisode & { season_number: number })[]> {
    const data = await invokeTvmaze<{ episodes: (TvmazeEpisode & { season_number: number })[] }>({
      action: 'episodes',
      id: tvmazeId,
      language,
      imdb_id: imdbId ?? undefined,
    })
    return data.episodes
  },
}

export const tvtimeWriteService = {
  async addShow(input: AddShowInput): Promise<void> {
    const { error } = await supabase.rpc('tvtime_add_show', {
      p_tvmaze_id: input.tvmazeId,
      p_name: input.name,
      p_original_name: input.originalName,
      p_poster_path: input.posterPath,
      p_backdrop_path: input.backdropPath,
      p_tvmaze_status: input.tvmazeStatus,
      p_imdb_id: input.imdbId,
      p_number_of_seasons: input.numberOfSeasons,
      p_number_of_episodes: input.numberOfEpisodes,
      p_user_status: input.userStatus,
      p_seasons: input.seasons,
      p_episodes: input.episodes,
      p_next_air_date: input.nextAirDate,
    })
    if (error) throw error
  },

  async addShowFromDetails(details: TvmazeShowDetails): Promise<void> {
    const episodes = await tvtimeService.fetchEpisodes(details.id, details.language, details.imdb_id)
    await tvtimeWriteService.addShow({
      tvmazeId: details.id,
      name: details.name,
      originalName: details.original_name,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      tvmazeStatus: details.status,
      imdbId: details.imdb_id,
      numberOfSeasons: details.number_of_seasons,
      numberOfEpisodes: details.number_of_episodes,
      userStatus: 'watching',
      seasons: details.seasons,
      episodes,
      nextAirDate: computeNextAirDate(episodes),
    })
  },

  async watchEpisode(episodeId: string, includePrevious = false): Promise<void> {
    const { error } = await supabase.rpc('tvtime_watch_episode', {
      p_episode_id: episodeId,
      p_watched: true,
      p_include_previous: includePrevious,
    })
    if (error) throw error
  },

  async unwatchEpisode(episodeId: string): Promise<void> {
    const { error } = await supabase.rpc('tvtime_watch_episode', {
      p_episode_id: episodeId,
      p_watched: false,
    })
    if (error) throw error
  },

  async watchSeason(seasonId: string, watched: boolean): Promise<void> {
    const { error } = await supabase.rpc('tvtime_watch_season', {
      p_season_id: seasonId,
      p_watched: watched,
    })
    if (error) throw error
  },

  async syncShow(
    tvmazeId: number,
    tvmazeStatus: string,
    imdbId: string | null,
    originalName: string | null,
    posterPath: string | null,
    backdropPath: string | null,
    numberOfSeasons: number,
    numberOfEpisodes: number,
    seasons: TvmazeShowDetails['seasons'],
    episodes: (TvmazeEpisode & { season_number: number })[],
    nextAirDate: string | null,
  ): Promise<void> {
    const { error } = await supabase.rpc('tvtime_sync_show', {
      p_tvmaze_id: tvmazeId,
      p_tvmaze_status: tvmazeStatus,
      p_imdb_id: imdbId,
      p_original_name: originalName,
      p_poster_path: posterPath,
      p_backdrop_path: backdropPath,
      p_number_of_seasons: numberOfSeasons,
      p_number_of_episodes: numberOfEpisodes,
      p_seasons: seasons,
      p_episodes: episodes,
      p_next_air_date: nextAirDate,
    })
    if (error) throw error
  },

  async setSeasonStatus(seasonId: string, status: ShowStatus): Promise<void> {
    const { error } = await supabase.rpc('tvtime_set_season_status', {
      p_season_id: seasonId,
      p_status: status,
    })
    if (error) throw error
  },
}
