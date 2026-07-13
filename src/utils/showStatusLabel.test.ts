import { describe, it, expect } from 'vitest'
import { isActiveTvmazeStatus, formatActiveLabel } from './showStatusLabel'

describe('isActiveTvmazeStatus', () => {
  it('treats Running, To Be Determined, and In Development as active', () => {
    expect(isActiveTvmazeStatus('Running')).toBe(true)
    expect(isActiveTvmazeStatus('To Be Determined')).toBe(true)
    expect(isActiveTvmazeStatus('In Development')).toBe(true)
  })

  it('treats Ended as not active — this also covers cancellation, TVmaze does not distinguish the two', () => {
    expect(isActiveTvmazeStatus('Ended')).toBe(false)
  })
})

describe('formatActiveLabel', () => {
  it('returns Active for active statuses', () => {
    expect(formatActiveLabel('Running')).toBe('Active')
  })

  it('returns Ended for the Ended status', () => {
    expect(formatActiveLabel('Ended')).toBe('Ended')
  })
})
