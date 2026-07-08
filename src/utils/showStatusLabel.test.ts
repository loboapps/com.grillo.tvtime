import { describe, it, expect } from 'vitest'
import { isActiveTmdbStatus, formatActiveLabel } from './showStatusLabel'

describe('isActiveTmdbStatus', () => {
  it('treats Returning Series, Planned, In Production, Pilot as active', () => {
    expect(isActiveTmdbStatus('Returning Series')).toBe(true)
    expect(isActiveTmdbStatus('Planned')).toBe(true)
    expect(isActiveTmdbStatus('In Production')).toBe(true)
    expect(isActiveTmdbStatus('Pilot')).toBe(true)
  })

  it('treats Ended and Canceled as not active', () => {
    expect(isActiveTmdbStatus('Ended')).toBe(false)
    expect(isActiveTmdbStatus('Canceled')).toBe(false)
  })
})

describe('formatActiveLabel', () => {
  it('returns Active for active statuses', () => {
    expect(formatActiveLabel('Returning Series')).toBe('Active')
  })

  it('returns Ended for ended statuses', () => {
    expect(formatActiveLabel('Ended')).toBe('Ended')
  })
})
