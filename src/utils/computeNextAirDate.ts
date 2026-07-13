export function computeNextAirDate(episodes: { air_date: string | null }[]): string | null {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = episodes
    .map((e) => e.air_date)
    .filter((date): date is string => !!date && date >= today)
    .sort()
  return upcoming[0] ?? null
}
