// ONE-OFF SCRIPT — applies the moves computed by full-reconcile.mjs for one show.
// Two-phase to avoid unique-constraint collisions when episode A's target slot
// is currently occupied by episode B, which is itself also moving elsewhere:
//   Phase 1: move every affected season to a temporary, guaranteed-unused
//            season_number (large negative offset unique per show).
//   Phase 2: move every episode from its temp position to its real target
//            season/episode number.
// This never touches episodes that were already correctly positioned
// (full-reconcile.mjs excludes those from the moves list) or episodes with
// no name match at all (left exactly as-is).
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/tvmaze-migration/apply-full-reconcile.mjs <tvmaze_id>

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OUT_DIR = dirname(fileURLToPath(import.meta.url))
const tvmazeId = Number(process.argv[2])
if (!tvmazeId) {
  console.error('Usage: node apply-full-reconcile.mjs <tvmaze_id>')
  process.exit(1)
}

const TEMP_OFFSET = -100000 // guaranteed far outside any real season_number range

async function getOrCreateSeason(showId, seasonNumber) {
  const { data: existing, error: selErr } = await supabase
    .from('tvtime_seasons')
    .select('id')
    .eq('show_id', showId)
    .eq('season_number', seasonNumber)
    .maybeSingle()
  if (selErr) throw selErr
  if (existing) return existing.id

  const { data: created, error: insErr } = await supabase
    .from('tvtime_seasons')
    .insert({ show_id: showId, season_number: seasonNumber })
    .select('id')
    .single()
  if (insErr) throw insErr
  return created.id
}

async function main() {
  const report = JSON.parse(readFileSync(join(OUT_DIR, `reconcile-report-${tvmazeId}.json`), 'utf-8'))
  const { data: show, error: showErr } = await supabase.from('tvtime_shows').select('id').eq('tvmaze_id', tvmazeId).single()
  if (showErr) throw showErr

  console.log(`${report.show}: applying ${report.moves.length} moves in 2 phases`)

  // Phase 1: park every affected episode at a unique temporary (season, episode) slot.
  console.log('Phase 1: parking at temporary positions...')
  for (let i = 0; i < report.moves.length; i++) {
    const m = report.moves[i]
    const tempSeasonId = await getOrCreateSeason(show.id, TEMP_OFFSET - i)
    const { error } = await supabase
      .from('tvtime_episodes')
      .update({ season_id: tempSeasonId, episode_number: 1 })
      .eq('id', m.episode_id)
    if (error) throw error
  }

  // Phase 2: move every episode from its temp slot to its real target slot.
  console.log('Phase 2: moving to final positions...')
  const seasonIdCache = new Map()
  for (let i = 0; i < report.moves.length; i++) {
    const m = report.moves[i]
    const key = m.to_season_number
    if (!seasonIdCache.has(key)) {
      seasonIdCache.set(key, await getOrCreateSeason(show.id, key))
    }
    const targetSeasonId = seasonIdCache.get(key)
    const { error } = await supabase
      .from('tvtime_episodes')
      .update({ season_id: targetSeasonId, episode_number: m.to_episode })
      .eq('id', m.episode_id)
    if (error) throw error
    console.log(`  '${m.name}' -> ${m.to_season_number}-${m.to_episode} (watched=${m.watched})`)
  }

  // Clean up now-empty temporary season rows.
  const { error: cleanupErr } = await supabase
    .from('tvtime_seasons')
    .delete()
    .eq('show_id', show.id)
    .lt('season_number', TEMP_OFFSET + 1)
  if (cleanupErr) throw cleanupErr

  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
