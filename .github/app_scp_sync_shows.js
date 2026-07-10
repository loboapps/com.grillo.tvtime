import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run')
const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'cron')
const LOG_RETENTION_DAYS = 7

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdbGet(path) {
  const res = await fetch(`${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`)
  if (!res.ok) throw new Error(`TMDB ${path} -> HTTP ${res.status}`)
  return res.json()
}

async function fetchSeason(tmdbId, seasonNumber) {
  const data = await tmdbGet(`/tv/${tmdbId}/season/${seasonNumber}`)
  return (data.episodes ?? []).map((ep) => ({ ...ep, season_number: seasonNumber }))
}

// Filenames carry the run date because `actions/checkout` resets file mtimes to checkout
// time — the name is the only reliable way to know a log's real age on the next run.
function writeSyncLog(summary) {
  mkdirSync(LOG_DIR, { recursive: true })
  const fileName = `sync-shows-${summary.date}.json`
  writeFileSync(join(LOG_DIR, fileName), JSON.stringify(summary, null, 2) + '\n')

  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const entry of readdirSync(LOG_DIR)) {
    const match = entry.match(/^sync-shows-(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    if (new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
      unlinkSync(join(LOG_DIR, entry))
    }
  }
}

// This is the only unconditional, whole-library step — discovering a season TMDB hasn't told
// us about yet is exactly what feeds next_air_date, so it can't itself be schedule-gated.
// Everything else (the Watch List page's own background sync) IS schedule-gated, using the
// next_air_date this step produces.
async function main() {
  const { data: shows, error: showsErr } = await supabase
    .from('tvtime_shows')
    .select('id, tmdb_id, number_of_seasons')
  if (showsErr) throw showsErr

  // A NULL air_date on an unwatched episode already *is* the "still missing data" signal —
  // no separate tracking table needed. Two plain queries (not a PostgREST embed join, to keep
  // this simple and predictable) get us show_id -> {season_id...} -> season_number.
  const { data: tbaEpisodes, error: tbaErr } = await supabase
    .from('tvtime_episodes')
    .select('show_id, season_id')
    .is('air_date', null)
    .eq('watched', false)
  if (tbaErr) throw tbaErr

  const tbaSeasonIds = [...new Set(tbaEpisodes.map((e) => e.season_id))]
  const { data: tbaSeasons, error: tbaSeasonsErr } =
    tbaSeasonIds.length > 0
      ? await supabase.from('tvtime_seasons').select('id, season_number').in('id', tbaSeasonIds)
      : { data: [], error: null }
  if (tbaSeasonsErr) throw tbaSeasonsErr
  const seasonNumberById = new Map(tbaSeasons.map((s) => [s.id, s.season_number]))

  const tbaSeasonsByShow = new Map() // show_id -> Set(season_number)
  for (const ep of tbaEpisodes) {
    const seasonNumber = seasonNumberById.get(ep.season_id)
    if (seasonNumber === undefined) continue
    if (!tbaSeasonsByShow.has(ep.show_id)) tbaSeasonsByShow.set(ep.show_id, new Set())
    tbaSeasonsByShow.get(ep.show_id).add(seasonNumber)
  }

  console.log(`${shows.length} tracked show(s). ${tbaSeasonsByShow.size} have a TBA episode to re-check.`)

  let unchanged = 0
  let updated = 0
  let failed = 0
  const updatedShows = []
  const failedShows = []

  for (const show of shows) {
    try {
      const details = await tmdbGet(`/tv/${show.tmdb_id}`)
      const nextAirDate = details.next_episode_to_air?.air_date ?? null

      const newSeasonNumbers = []
      for (let n = (show.number_of_seasons ?? 0) + 1; n <= details.number_of_seasons; n++) {
        newSeasonNumbers.push(n)
      }
      const tbaSeasonNumbers = [...(tbaSeasonsByShow.get(show.id) ?? [])]
      const seasonsToFetch = [...new Set([...newSeasonNumbers, ...tbaSeasonNumbers])]

      if (seasonsToFetch.length === 0) {
        // Nothing changed and nothing missing — just keep status/counts/next_air_date/synced_at
        // current. No season/episode fetch, no tvtime_sync_show round trip.
        if (!DRY_RUN) {
          const { error } = await supabase
            .from('tvtime_shows')
            .update({
              tmdb_status: details.status,
              number_of_episodes: details.number_of_episodes,
              next_air_date: nextAirDate,
              synced_at: new Date().toISOString(),
            })
            .eq('id', show.id)
          if (error) throw error
        }
        unchanged++
        continue
      }

      const seasonMetas = details.seasons.filter((s) => seasonsToFetch.includes(s.season_number))
      const episodes = (
        await Promise.all(seasonsToFetch.map((n) => fetchSeason(show.tmdb_id, n)))
      ).flat()

      if (DRY_RUN) {
        console.log(
          `  [dry-run] would update ${show.tmdb_id} (${details.name}): seasons ${seasonsToFetch.join(', ')}, ${episodes.length} episodes`,
        )
      } else {
        const { error } = await supabase.rpc('tvtime_sync_show', {
          p_tmdb_id: show.tmdb_id,
          p_tmdb_status: details.status,
          p_number_of_seasons: details.number_of_seasons,
          p_number_of_episodes: details.number_of_episodes,
          p_seasons: seasonMetas,
          p_episodes: episodes,
          p_next_air_date: nextAirDate,
        })
        if (error) throw error
      }
      updated++
      updatedShows.push({
        tmdb_id: show.tmdb_id,
        name: details.name,
        old_seasons: show.number_of_seasons ?? 0,
        new_seasons:
          newSeasonNumbers.length > 0
            ? {
                numbers: newSeasonNumbers,
                episodes_synced: episodes.filter((ep) => newSeasonNumbers.includes(ep.season_number)).length,
              }
            : null,
        resolved_tba_seasons: tbaSeasonNumbers,
        next_air_date: nextAirDate,
      })
    } catch (err) {
      failed++
      failedShows.push({ tmdb_id: show.tmdb_id, error: err.message })
      console.error(`  failed on show ${show.tmdb_id}:`, err.message)
    }
  }

  console.log(`Done: ${unchanged} unchanged, ${updated} updated (new season or resolved date), ${failed} failed`)

  if (!DRY_RUN) {
    writeSyncLog({
      date: new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString(),
      totals: { tracked: shows.length, unchanged, updated, failed },
      updated: updatedShows,
      failed: failedShows,
    })
  }

  if (failed > 0 && updated === 0 && unchanged === 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
