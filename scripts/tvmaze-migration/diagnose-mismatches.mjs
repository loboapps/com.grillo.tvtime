// ONE-OFF SCRIPT — deep diagnostic for the 43 shows validate-numbering.mjs flagged
// with a real (non-season-0-only) numbering mismatch. For each conflicting
// (season,episode) key on either side, pulls the actual stored episode row
// (name/air_date/watched) and the actual TVmaze episode row (name/airdate),
// so each case can be reasoned about with real data instead of guesses.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/tvmaze-migration/diagnose-mismatches.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OUT_DIR = dirname(fileURLToPath(import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseKey(key) {
  const [season, episode] = key.split('-').map(Number)
  return { season, episode }
}

async function main() {
  const { data: validation } = { data: JSON.parse(readFileSync(join(OUT_DIR, 'validation-report.json'), 'utf-8')) }

  const realMismatches = validation.mismatches.filter((m) => {
    const onlyStoredSeasons = new Set(m.onlyStored.map((k) => k.split('-')[0]))
    return !(onlyStoredSeasons.size === 0 || [...onlyStoredSeasons].every((s) => s === '0')) || m.onlyTvmaze.length > 0
  }).filter((m) => {
    // Exclude the pure "season-0-specials-only, nothing else" cases already categorized separately
    const onlyStoredSeasons = new Set(m.onlyStored.map((k) => k.split('-')[0]))
    const isPureSeason0 = onlyStoredSeasons.size > 0 && [...onlyStoredSeasons].every((s) => s === '0') && m.onlyTvmaze.length === 0
    return !isPureSeason0
  })

  console.log(`Diagnosing ${realMismatches.length} shows...`)

  const diagnostics = []

  for (const m of realMismatches) {
    const { data: show } = await supabase.from('tvtime_shows').select('id').eq('tvmaze_id', m.tvmaze_id).single()

    // Pull actual stored rows for every stored-only key
    const storedDetails = []
    for (const key of m.onlyStored) {
      const { season, episode } = parseKey(key)
      const { data: rows } = await supabase
        .from('tvtime_episodes')
        .select('episode_number, name, air_date, watched, tvtime_seasons!inner(season_number)')
        .eq('show_id', show.id)
        .eq('episode_number', episode)
      const match = (rows ?? []).find((r) => r.tvtime_seasons.season_number === season)
      if (match) {
        storedDetails.push({ key, name: match.name, air_date: match.air_date, watched: match.watched })
      }
    }

    // Fetch full TVmaze episode list once, pull the tvmaze-only keys' details from it
    let tvmazeEpisodes = []
    try {
      const res = await fetch(`https://api.tvmaze.com/shows/${m.tvmaze_id}/episodes`)
      if (res.ok) tvmazeEpisodes = await res.json()
    } catch {
      // leave empty — reported as unavailable below
    }
    const tvmazeByKey = new Map(tvmazeEpisodes.map((e) => [`${e.season}-${e.number}`, e]))
    const tvmazeOnlyDetails = m.onlyTvmaze.map((key) => {
      const e = tvmazeByKey.get(key)
      return e ? { key, name: e.name, air_date: e.airdate } : { key, name: null, air_date: null }
    })

    const watchedAtRisk = storedDetails.filter((d) => d.watched)

    diagnostics.push({
      name: m.name,
      tvmaze_id: m.tvmaze_id,
      show_id: show.id,
      stored_only_count: m.onlyStored.length,
      tvmaze_only_count: m.onlyTvmaze.length,
      watched_at_risk_count: watchedAtRisk.length,
      stored_only_details: storedDetails,
      tvmaze_only_details: tvmazeOnlyDetails,
    })

    console.log(`  ${m.name}: ${storedDetails.length} stored-only rows read, ${watchedAtRisk.length} watched`)
    await sleep(550)
  }

  writeFileSync(join(OUT_DIR, 'diagnostics-report.json'), JSON.stringify(diagnostics, null, 2) + '\n')
  console.log('Done. Wrote diagnostics-report.json')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
