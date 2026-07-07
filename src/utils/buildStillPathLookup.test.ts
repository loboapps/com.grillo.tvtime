import { describe, it, expect } from 'vitest'
import { buildStillPathLookup } from './buildStillPathLookup'
import type { TmdbEpisode } from '@/types/tvtime'

function makeEpisode(seasonNumber: number, episodeNumber: number, stillPath: string | null): TmdbEpisode & { season_number: number } {
  return { season_number: seasonNumber, episode_number: episodeNumber, name: `S${seasonNumber}E${episodeNumber}`, air_date: null, still_path: stillPath }
}

describe('buildStillPathLookup', () => {
  it('keys by season_number-episode_number', () => {
    const lookup = buildStillPathLookup([makeEpisode(1, 1, '/abc.jpg'), makeEpisode(1, 2, null)])
    expect(lookup['1-1']).toBe('/abc.jpg')
    expect(lookup['1-2']).toBeNull()
  })

  it('distinguishes the same episode number across different seasons', () => {
    const lookup = buildStillPathLookup([makeEpisode(1, 1, '/s1e1.jpg'), makeEpisode(2, 1, '/s2e1.jpg')])
    expect(lookup['1-1']).toBe('/s1e1.jpg')
    expect(lookup['2-1']).toBe('/s2e1.jpg')
  })

  it('returns an empty object for an empty input', () => {
    expect(buildStillPathLookup([])).toEqual({})
  })
})
