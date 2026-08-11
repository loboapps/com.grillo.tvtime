export function formatShortDate(airDate: string): string {
  const [year, month, day] = airDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}
