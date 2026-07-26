// Synthetic ids used for season/episode rows built from live TVmaze data before
// the show has been added to the library — there's no real DB row yet.
const PREVIEW_ID_PREFIX = 'preview-'

export function previewSeasonId(seasonNumber: number): string {
  return `${PREVIEW_ID_PREFIX}${seasonNumber}`
}

export function previewEpisodeId(seasonNumber: number, episodeNumber: number): string {
  return `${PREVIEW_ID_PREFIX}${seasonNumber}-${episodeNumber}`
}

export function isPreviewId(id: string): boolean {
  return id.startsWith(PREVIEW_ID_PREFIX)
}
