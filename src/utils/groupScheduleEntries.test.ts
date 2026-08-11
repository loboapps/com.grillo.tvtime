import { describe, it, expect } from 'vitest'
import { groupScheduleEntries } from './groupScheduleEntries'
import type { ScheduleEntry } from '@/types/tvtime'

function entry(airDate: string, name = 'Show'): ScheduleEntry {
  return {
    episode_id: `${name}-${airDate}`,
    show_id: name,
    tvmaze_id: 1,
    name,
    poster_path: null,
    season_number: 1,
    episode_number: 1,
    episode_name: null,
    air_date: airDate,
    airstamp: null,
  }
}

function dateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('groupScheduleEntries', () => {
  it('buckets today, tomorrow, weekday, this month, and in the future', () => {
    const today = new Date(2026, 7, 3) // Monday, Aug 3 2026
    const entries = [
      entry(dateStr(today)),
      entry(dateStr(new Date(2026, 7, 4))),
      entry(dateStr(new Date(2026, 7, 6))),
      entry(dateStr(new Date(2026, 7, 20))),
      entry(dateStr(new Date(2026, 8, 1))),
    ]

    const groups = groupScheduleEntries(entries, today)

    expect(groups.map((g) => g.label)).toEqual(['Today', 'Tomorrow', 'Thursday', 'This Month', 'In the Future'])
    expect(groups[0].entries).toHaveLength(1)
    expect(groups[1].entries).toHaveLength(1)
    expect(groups[2].entries).toHaveLength(1)
    expect(groups[3].entries).toHaveLength(1)
    expect(groups[4].entries).toHaveLength(1)
  })

  it('omits groups with no entries', () => {
    const today = new Date(2026, 7, 3)
    const entries = [entry(dateStr(today))]

    const groups = groupScheduleEntries(entries, today)

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
  })

  it('returns an empty array when there are no entries', () => {
    expect(groupScheduleEntries([], new Date(2026, 7, 3))).toEqual([])
  })

  it('falls to In the Future when today is near month end, leaving This Month empty', () => {
    const today = new Date(2026, 7, 28) // Aug 28 2026
    const entries = [
      entry(dateStr(today)),
      entry(dateStr(new Date(2026, 8, 10))),
    ]

    const groups = groupScheduleEntries(entries, today)

    expect(groups.map((g) => g.label)).toEqual(['Today', 'In the Future'])
  })

  it('preserves input order within a group', () => {
    const today = new Date(2026, 7, 3)
    const target = dateStr(new Date(2026, 8, 15))
    const entries = [entry(target, 'Zebra'), entry(target, 'Alpha'), entry(target, 'Mango')]

    const groups = groupScheduleEntries(entries, today)

    expect(groups[0].label).toBe('In the Future')
    expect(groups[0].entries.map((e) => e.name)).toEqual(['Zebra', 'Alpha', 'Mango'])
  })

  it('groups a weekday within the 2-7 day window using its full weekday name', () => {
    const today = new Date(2026, 7, 3) // Monday
    const dayFive = new Date(2026, 7, 8) // Saturday, today + 5
    const dayTwo = new Date(2026, 7, 5) // Wednesday, today + 2
    const daySeven = new Date(2026, 7, 10) // Monday, today + 7

    const entries = [entry(dateStr(dayFive)), entry(dateStr(dayTwo)), entry(dateStr(daySeven))]
    const groups = groupScheduleEntries(entries, today)

    expect(groups.map((g) => g.label)).toEqual(['Wednesday', 'Saturday', 'Monday'])
  })
})
