export function isActiveTvmazeStatus(tvmazeStatus: string): boolean {
  return tvmazeStatus !== 'Ended'
}

export function formatActiveLabel(tvmazeStatus: string): 'Active' | 'Ended' {
  return isActiveTvmazeStatus(tvmazeStatus) ? 'Active' : 'Ended'
}
