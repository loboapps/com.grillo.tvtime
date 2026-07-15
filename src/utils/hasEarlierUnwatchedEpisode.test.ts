import { describe, it, expect } from 'vitest'
import { hasEarlierUnwatchedEpisode } from './hasEarlierUnwatchedEpisode'
import type { ShowSeasonDetail } from '@/types/tvtime'

function makeSeason(seasonNumber: number, episodes: { episode_number: number; watched: boolean }[]): ShowSeasonDetail {
  return {
    season_id: `season-${seasonNumber}`,
    season_number: seasonNumber,
    name: null,
    user_status: null,
    episode_count: episodes.length,
    watched_count: episodes.filter((e) => e.watched).length,
    episodes: episodes.map((e) => ({
      episode_id: `ep-${seasonNumber}-${e.episode_number}`,
      episode_number: e.episode_number,
      name: null,
      air_date: null,
      watched: e.watched,
      watched_at: null,
    })),
  }
}

describe('hasEarlierUnwatchedEpisode', () => {
  it('returns true when an earlier episode in the same season is unwatched', () => {
    const seasons = [makeSeason(1, [{ episode_number: 1, watched: false }, { episode_number: 2, watched: false }])]
    expect(hasEarlierUnwatchedEpisode(seasons, 1, 2)).toBe(true)
  })

  it('returns false when all earlier episodes in the same season are already watched', () => {
    const seasons = [makeSeason(1, [{ episode_number: 1, watched: true }, { episode_number: 2, watched: false }])]
    expect(hasEarlierUnwatchedEpisode(seasons, 1, 2)).toBe(false)
  })

  it('returns true when an entire earlier season has an unwatched episode', () => {
    const seasons = [
      makeSeason(1, [{ episode_number: 1, watched: false }]),
      makeSeason(2, [{ episode_number: 1, watched: false }]),
    ]
    expect(hasEarlierUnwatchedEpisode(seasons, 2, 1)).toBe(true)
  })

  it('ignores later seasons and later episodes in the same season', () => {
    const seasons = [
      makeSeason(1, [{ episode_number: 1, watched: true }]),
      makeSeason(2, [{ episode_number: 1, watched: true }, { episode_number: 2, watched: false }]),
    ]
    expect(hasEarlierUnwatchedEpisode(seasons, 2, 1)).toBe(false)
  })

  it('ignores unwatched specials (season 0) — they are not part of the sequential watch order', () => {
    const seasons = [
      makeSeason(0, [{ episode_number: 1, watched: false }]),
      makeSeason(1, [{ episode_number: 1, watched: true }, { episode_number: 2, watched: false }]),
    ]
    expect(hasEarlierUnwatchedEpisode(seasons, 1, 2)).toBe(false)
  })
})
