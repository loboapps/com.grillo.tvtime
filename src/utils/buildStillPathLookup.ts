import type { TvmazeEpisode } from '@/types/tvtime'

export function buildStillPathLookup(
  episodes: (TvmazeEpisode & { season_number: number })[],
): Record<string, string | null> {
  const lookup: Record<string, string | null> = {}
  for (const episode of episodes) {
    lookup[`${episode.season_number}-${episode.episode_number}`] = episode.still_path
  }
  return lookup
}
