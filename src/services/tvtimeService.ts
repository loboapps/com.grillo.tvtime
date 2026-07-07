import { supabase } from '@/lib/supabaseClient'
import type {
  AddShowInput,
  ShowStatus,
  TmdbSearchResult,
  TmdbShowDetails,
  TmdbSeason,
  TmdbEpisode,
  Watchlist,
} from '@/types/tvtime'

async function invokeTmdb<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('tvtime-tmdb', { body })
  if (error) throw error
  return data as T
}

export const tvtimeService = {
  async loadWatchlist(): Promise<Watchlist> {
    const { data, error } = await supabase.rpc('tvtime_load_watchlist')
    if (error) throw error
    return data as Watchlist
  },

  async loadStaleShowIds(): Promise<number[]> {
    const { data, error } = await supabase.rpc('tvtime_load_stale_shows')
    if (error) throw error
    return data as number[]
  },

  async searchShows(query: string): Promise<TmdbSearchResult[]> {
    const data = await invokeTmdb<{ results: TmdbSearchResult[] }>({ action: 'search', query })
    return data.results
  },

  async getShowDetails(tmdbId: number): Promise<TmdbShowDetails> {
    return invokeTmdb<TmdbShowDetails>({ action: 'show', id: tmdbId })
  },

  async getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<TmdbEpisode[]> {
    const data = await invokeTmdb<{ episodes: TmdbEpisode[] }>({
      action: 'season',
      id: tmdbId,
      season: seasonNumber,
    })
    return data.episodes
  },

  async fetchAllEpisodes(
    tmdbId: number,
    seasons: TmdbSeason[],
  ): Promise<(TmdbEpisode & { season_number: number })[]> {
    const episodesBySeason = await Promise.all(
      seasons.map(async (season) => {
        const episodes = await tvtimeService.getSeasonEpisodes(tmdbId, season.season_number)
        return episodes.map((ep) => ({ ...ep, season_number: season.season_number }))
      }),
    )
    return episodesBySeason.flat()
  },
}

export const tvtimeWriteService = {
  async addShow(input: AddShowInput): Promise<void> {
    const { error } = await supabase.rpc('tvtime_add_show', {
      p_tmdb_id: input.tmdbId,
      p_name: input.name,
      p_poster_path: input.posterPath,
      p_backdrop_path: input.backdropPath,
      p_tmdb_status: input.tmdbStatus,
      p_number_of_seasons: input.numberOfSeasons,
      p_number_of_episodes: input.numberOfEpisodes,
      p_user_status: input.userStatus,
      p_seasons: input.seasons,
      p_episodes: input.episodes,
    })
    if (error) throw error
  },

  async watchEpisode(episodeId: string): Promise<void> {
    const { error } = await supabase.rpc('tvtime_watch_episode', {
      p_episode_id: episodeId,
      p_watched: true,
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

  async syncShow(
    tmdbId: number,
    tmdbStatus: string,
    numberOfSeasons: number,
    numberOfEpisodes: number,
    seasons: TmdbSeason[],
    episodes: (TmdbEpisode & { season_number: number })[],
  ): Promise<void> {
    const { error } = await supabase.rpc('tvtime_sync_show', {
      p_tmdb_id: tmdbId,
      p_tmdb_status: tmdbStatus,
      p_number_of_seasons: numberOfSeasons,
      p_number_of_episodes: numberOfEpisodes,
      p_seasons: seasons,
      p_episodes: episodes,
    })
    if (error) throw error
  },

  async setShowStatus(showId: string, status: ShowStatus): Promise<void> {
    const { error } = await supabase.rpc('tvtime_set_show_status', {
      p_show_id: showId,
      p_status: status,
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
