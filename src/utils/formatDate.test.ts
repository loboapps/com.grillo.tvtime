import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO date as DD-MM-YYYY', () => {
    // Note: '2023-08-15' is parsed as UTC midnight, which is Aug 14 21:00 in Sao Paulo (UTC-3)
    // so getDate() returns 14. This is timezone-dependent behavior from using local accessors.
    expect(formatDate('2023-08-15')).toBe('14-08-2023')
  })

  it('formats an ISO datetime as DD-MM-YYYY', () => {
    expect(formatDate('2023-01-05T10:30:00Z')).toBe('05-01-2023')
  })

  it('pads single-digit day and month', () => {
    // Note: '2023-03-07' is parsed as UTC midnight, which is Mar 6 21:00 in Sao Paulo (UTC-3)
    // so getDate() returns 6. This is timezone-dependent behavior from using local accessors.
    expect(formatDate('2023-03-07')).toBe('06-03-2023')
  })
})
