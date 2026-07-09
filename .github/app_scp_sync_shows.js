import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdbGet(path) {
  const res = await fetch(`${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`)
  if (!res.ok) throw new Error(`TMDB ${path} -> HTTP ${res.status}`)
  return res.json()
}

async function fetchAllEpisodes(tmdbId, seasons) {
  const bySeasonPromises = seasons.map(async (season) => {
    const data = await tmdbGet(`/tv/${tmdbId}/season/${season.season_number}`)
    return (data.episodes ?? []).map((ep) => ({ ...ep, season_number: season.season_number }))
  })
  return (await Promise.all(bySeasonPromises)).flat()
}

async function syncOneShow(tmdbId) {
  const details = await tmdbGet(`/tv/${tmdbId}`)
  const episodes = await fetchAllEpisodes(tmdbId, details.seasons ?? [])

  if (DRY_RUN) {
    console.log(`  [dry-run] would sync ${tmdbId} (${details.name}): ${details.seasons?.length ?? 0} seasons, ${episodes.length} episodes`)
    return
  }

  const { error } = await supabase.rpc('tvtime_sync_show', {
    p_tmdb_id: tmdbId,
    p_tmdb_status: details.status,
    p_number_of_seasons: details.number_of_seasons,
    p_number_of_episodes: details.number_of_episodes,
    p_seasons: details.seasons,
    p_episodes: episodes,
  })
  if (error) throw error
}

async function main() {
  const { data: staleIds, error } = await supabase.rpc('tvtime_load_stale_shows')
  if (error) throw error

  console.log(`${staleIds.length} show(s) due for sync${DRY_RUN ? ' (dry run)' : ''}`)

  let ok = 0
  let failed = 0
  for (const tmdbId of staleIds) {
    try {
      await syncOneShow(tmdbId)
      ok++
    } catch (err) {
      failed++
      console.error(`  failed to sync ${tmdbId}:`, err.message)
    }
  }

  console.log(`Done: ${ok} synced, ${failed} failed`)
  if (failed > 0 && ok === 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
