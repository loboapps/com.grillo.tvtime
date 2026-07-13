import { describe, it, expect } from 'vitest'
import { sortSearchResultsByRelevance } from './sortSearchResults'
import type { TvmazeSearchResult } from '@/types/tvtime'

function makeResult(id: number, name: string, weight: number): TvmazeSearchResult {
  return { id, name, poster_path: null, weight }
}

describe('sortSearchResultsByRelevance', () => {
  it('puts an exact title match first regardless of weight', () => {
    const results = [makeResult(1, 'Silent Witness', 50), makeResult(2, 'Silo', 5)]
    const sorted = sortSearchResultsByRelevance(results, 'Silo')
    expect(sorted[0].name).toBe('Silo')
  })

  it('is case-insensitive for exact match', () => {
    const results = [makeResult(1, 'Silent Witness', 50), makeResult(2, 'SILO', 5)]
    const sorted = sortSearchResultsByRelevance(results, 'silo')
    expect(sorted[0].name).toBe('SILO')
  })

  it('puts a prefix match before a non-prefix match when neither is exact', () => {
    const results = [makeResult(1, 'Sil de strandjutter', 50), makeResult(2, 'Silent Witness', 5)]
    const sorted = sortSearchResultsByRelevance(results, 'Silent')
    expect(sorted[0].name).toBe('Silent Witness')
  })

  it('falls back to weight when relevance tier is the same', () => {
    const results = [makeResult(1, 'Silo Show A', 5), makeResult(2, 'Silo Show B', 50)]
    const sorted = sortSearchResultsByRelevance(results, 'unrelated query')
    expect(sorted[0].name).toBe('Silo Show B')
  })
})
