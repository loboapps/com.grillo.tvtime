import type { ScheduleEntry } from '@/types/tvtime'

export interface ScheduleGroup {
  label: string
  entries: ScheduleEntry[]
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function groupScheduleEntries(entries: ScheduleEntry[], today: Date): ScheduleGroup[] {
  const todayOnly = toDateOnly(today)
  const tomorrow = addDays(todayOnly, 1)
  const weekEnd = addDays(todayOnly, 7)

  const weekdayLabels: string[] = []
  for (let offset = 2; offset <= 7; offset++) {
    weekdayLabels.push(addDays(todayOnly, offset).toLocaleDateString('en-US', { weekday: 'long' }))
  }

  const order = ['Today', 'Tomorrow', ...weekdayLabels, 'This Month', 'In the Future']
  const buckets = new Map<string, ScheduleEntry[]>(order.map((label) => [label, []]))

  for (const entry of entries) {
    const entryDate = parseLocalDate(entry.air_date)

    let label: string
    if (entryDate.getTime() === todayOnly.getTime()) {
      label = 'Today'
    } else if (entryDate.getTime() === tomorrow.getTime()) {
      label = 'Tomorrow'
    } else if (entryDate.getTime() > tomorrow.getTime() && entryDate.getTime() <= weekEnd.getTime()) {
      label = entryDate.toLocaleDateString('en-US', { weekday: 'long' })
    } else if (
      entryDate.getTime() > weekEnd.getTime() &&
      entryDate.getFullYear() === todayOnly.getFullYear() &&
      entryDate.getMonth() === todayOnly.getMonth()
    ) {
      label = 'This Month'
    } else {
      label = 'In the Future'
    }

    buckets.get(label)?.push(entry)
  }

  return order
    .map((label) => ({ label, entries: buckets.get(label) ?? [] }))
    .filter((group) => group.entries.length > 0)
}
