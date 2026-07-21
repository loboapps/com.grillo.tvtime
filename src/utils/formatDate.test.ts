/// <reference types="node" />
process.env.TZ = 'America/Sao_Paulo'

import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO date as DD-MM-YYYY', () => {
    // '2023-08-15' parses as UTC midnight; in the pinned America/Sao_Paulo
    // timezone (UTC-3) that's Aug 14, 21:00 local — hence getDate() returns 14.
    expect(formatDate('2023-08-15')).toBe('14-08-2023')
  })

  it('formats an ISO datetime as DD-MM-YYYY', () => {
    expect(formatDate('2023-01-05T10:30:00Z')).toBe('05-01-2023')
  })

  it('pads single-digit day and month', () => {
    // '2023-03-07' parses as UTC midnight; in the pinned America/Sao_Paulo
    // timezone (UTC-3) that's Mar 6, 21:00 local — hence getDate() returns 6.
    expect(formatDate('2023-03-07')).toBe('06-03-2023')
  })
})
