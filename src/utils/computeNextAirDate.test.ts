import { describe, it, expect } from 'vitest'
import { computeNextAirDate } from './computeNextAirDate'

describe('computeNextAirDate', () => {
  it('returns the earliest air_date that is today or later', () => {
    const today = new Date().toISOString().slice(0, 10)
    const future = '2099-01-01'
    const past = '2000-01-01'
    expect(computeNextAirDate([{ air_date: past }, { air_date: future }, { air_date: today }])).toBe(today)
  })

  it('ignores null and empty-string air dates', () => {
    const future = '2099-01-01'
    expect(computeNextAirDate([{ air_date: null }, { air_date: '' }, { air_date: future }])).toBe(future)
  })

  it('returns null when every date is in the past', () => {
    expect(computeNextAirDate([{ air_date: '2000-01-01' }, { air_date: '2001-01-01' }])).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(computeNextAirDate([])).toBeNull()
  })
})
