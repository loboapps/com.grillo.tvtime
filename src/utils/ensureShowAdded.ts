import { tvtimeService, tvtimeWriteService } from '@/services/tvtimeService'
import type { ShowDetail, TvmazeShowDetails } from '@/types/tvtime'

// Adds a show to the library from its live TVmaze details, then loads back the
// DB-backed detail (real season/episode ids) so callers can resolve a preview
// row into a real one right after adding.
export async function ensureShowAdded(tvmazeId: number, tvmazeDetails: TvmazeShowDetails): Promise<ShowDetail> {
  await tvtimeWriteService.addShowFromDetails(tvmazeDetails)
  const detail = await tvtimeService.loadShow(tvmazeId)
  if (!detail) throw new Error('Failed to load show after adding it')
  return detail
}
