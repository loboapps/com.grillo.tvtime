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
  it('returns Ativa for active statuses', () => {
    expect(formatActiveLabel('Returning Series')).toBe('Ativa')
  })

  it('returns Encerrada for ended statuses', () => {
    expect(formatActiveLabel('Ended')).toBe('Encerrada')
  })
})
