// ONE-OFF SCRIPT — full season/episode reconciliation for shows where the
// quick diff (validate-numbering.mjs) proved unreliable: TMDB and TVmaze can
// both have a full, non-empty season at the same season_number with entirely
// different episodes, which a key-existence diff can't see. This does a
// complete name+date match across EVERY stored episode vs EVERY TVmaze
// episode for the given show, not just the previously-flagged ones.
//
// REPORT ONLY — writes nothing. Output: reconcile-report-<tvmaze_id>.json
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/tvmaze-migration/full-reconcile.mjs <tvmaze_id>

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OUT_DIR = dirname(fileURLToPath(import.meta.url))
const tvmazeId = Number(process.argv[2])
if (!tvmazeId) {
  console.error('Usage: node full-reconcile.mjs <tvmaze_id>')
  process.exit(1)
}

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function main() {
  const { data: show, error: showErr } = await supabase
    .from('tvtime_shows')
    .select('id, name')
    .eq('tvmaze_id', tvmazeId)
    .single()
  if (showErr) throw showErr

  const { data: storedEpisodes, error: epErr } = await supabase
    .from('tvtime_episodes')
    .select('id, episode_number, name, air_date, watched, watched_at, tvtime_seasons!inner(id, season_number)')
    .eq('show_id', show.id)
  if (epErr) throw epErr

  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`)
  const tvmazeEpisodes = await res.json()

  const tvmazeByName = new Map()
  for (const e of tvmazeEpisodes) {
    const key = normalize(e.name)
    if (!tvmazeByName.has(key)) tvmazeByName.set(key, [])
    tvmazeByName.get(key).push(e)
  }

  const matched = []
  const unmatchedStored = []

  for (const s of storedEpisodes) {
    const key = normalize(s.name)
    const candidates = tvmazeByName.get(key) ?? []
    let chosen = null
    if (candidates.length === 1) {
      chosen = candidates[0]
    } else if (candidates.length > 1) {
      chosen = candidates.find((c) => c.airdate === s.air_date) ?? null
    }

    const alreadyCorrect = chosen && chosen.season === s.tvtime_seasons.season_number && chosen.number === s.episode_number

    if (chosen && !alreadyCorrect) {
      matched.push({
        episode_id: s.id,
        name: s.name,
        watched: s.watched,
        from_season_number: s.tvtime_seasons.season_number,
        from_episode: s.episode_number,
        to_season_number: chosen.season,
        to_episode: chosen.number,
      })
    } else if (!chosen) {
      unmatchedStored.push({
        episode_id: s.id,
        name: s.name,
        air_date: s.air_date,
        watched: s.watched,
        season_number: s.tvtime_seasons.season_number,
        episode_number: s.episode_number,
        candidates_by_name_count: candidates.length,
      })
    }
    // alreadyCorrect: no action needed, not included in either list
  }

  const report = {
    show: show.name,
    tvmaze_id: tvmazeId,
    total_stored: storedEpisodes.length,
    total_tvmaze: tvmazeEpisodes.length,
    needs_move: matched.length,
    unmatched_stored: unmatchedStored.length,
    moves: matched,
    unmatched: unmatchedStored,
  }
  writeFileSync(join(OUT_DIR, `reconcile-report-${tvmazeId}.json`), JSON.stringify(report, null, 2) + '\n')

  console.log(`${show.name}: ${storedEpisodes.length} stored, ${tvmazeEpisodes.length} on tvmaze`)
  console.log(`  needs move (matched by name, wrong position): ${matched.length}`)
  console.log(`  unmatched (no name match found at all): ${unmatchedStored.length}`)
  const watchedUnmatched = unmatchedStored.filter((u) => u.watched)
  if (watchedUnmatched.length > 0) {
    console.log(`  ⚠ WATCHED but unmatched: ${watchedUnmatched.length}`)
    for (const u of watchedUnmatched) console.log(`      ${u.season_number}-${u.episode_number} '${u.name}'`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
