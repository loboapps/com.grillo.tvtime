import { describe, it, expect } from 'vitest'
import { stripHtml } from './stripHtml'

describe('stripHtml', () => {
  it('removes tags from a simple paragraph', () => {
    expect(stripHtml('<p>Jesse and Walt cook their first batch.</p>')).toBe(
      'Jesse and Walt cook their first batch.',
    )
  })

  it('joins multiple paragraphs with a single space', () => {
    expect(stripHtml('<p>First sentence.</p><p>Second sentence.</p>')).toBe(
      'First sentence. Second sentence.',
    )
  })

  it('decodes common HTML entities', () => {
    expect(stripHtml('Rock &amp; Roll &mdash; a &quot;great&quot; episode')).toBe(
      'Rock & Roll — a "great" episode',
    )
  })

  it('collapses repeated whitespace and trims the result', () => {
    expect(stripHtml('  <p>  Padded   text.  </p>  ')).toBe('Padded text.')
  })

  it('returns an empty string for an empty or whitespace-only input', () => {
    expect(stripHtml('')).toBe('')
    expect(stripHtml('   ')).toBe('')
    expect(stripHtml('<p></p>')).toBe('')
  })
})
