const ACTIVE_STATUSES = new Set(['Returning Series', 'Planned', 'In Production', 'Pilot'])

export function isActiveTmdbStatus(tmdbStatus: string): boolean {
  return ACTIVE_STATUSES.has(tmdbStatus)
}

export function formatActiveLabel(tmdbStatus: string): 'Active' | 'Ended' {
  return isActiveTmdbStatus(tmdbStatus) ? 'Active' : 'Ended'
}
