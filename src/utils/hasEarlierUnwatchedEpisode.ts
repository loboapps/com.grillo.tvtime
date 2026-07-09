import type { ShowSeasonDetail } from '@/types/tvtime'

export function hasEarlierUnwatchedEpisode(
  seasons: ShowSeasonDetail[],
  targetSeasonNumber: number,
  targetEpisodeNumber: number,
): boolean {
  for (const season of seasons) {
    if (season.season_number === 0) continue // specials aren't part of the sequential watch order
    for (const episode of season.episodes) {
      if (episode.watched) continue
      if (season.season_number < targetSeasonNumber) return true
      if (season.season_number === targetSeasonNumber && episode.episode_number < targetEpisodeNumber) return true
    }
  }
  return false
}
