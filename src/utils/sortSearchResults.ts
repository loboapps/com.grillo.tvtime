import type { TmdbSearchResult } from '@/types/tvtime'

export function sortSearchResultsByRelevance(
  results: TmdbSearchResult[],
  query: string,
): TmdbSearchResult[] {
  const q = query.trim().toLowerCase()

  return [...results].sort((a, b) => {
    const aExact = a.name.toLowerCase() === q
    const bExact = b.name.toLowerCase() === q
    if (aExact !== bExact) return aExact ? -1 : 1

    const aStarts = a.name.toLowerCase().startsWith(q)
    const bStarts = b.name.toLowerCase().startsWith(q)
    if (aStarts !== bStarts) return aStarts ? -1 : 1

    return b.popularity - a.popularity
  })
}
