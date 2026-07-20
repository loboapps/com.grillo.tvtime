import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO date as DD-MM-YYYY', () => {
    expect(formatDate('2023-08-15')).toBe('15-08-2023')
  })

  it('formats an ISO datetime as DD-MM-YYYY', () => {
    expect(formatDate('2023-01-05T10:30:00Z')).toBe('05-01-2023')
  })

  it('pads single-digit day and month', () => {
    expect(formatDate('2023-03-07')).toBe('07-03-2023')
  })
})
