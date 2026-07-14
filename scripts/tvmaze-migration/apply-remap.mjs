// ONE-OFF SCRIPT — see scripts/tvmaze-migration/remap.mjs header and
// docs/superpowers/plans/2026-07-12-tvmaze-migration.md, Fase 10.
// Reads approved.json (hand-reviewed, see Task 22) and applies ONLY what's
// listed there. Never invents a match on its own.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/tvmaze-migration/apply-remap.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OUT_DIR = dirname(fileURLToPath(import.meta.url))
const approved = JSON.parse(readFileSync(join(OUT_DIR, 'approved.json'), 'utf-8'))

async function applySetTvmazeId({ show_id, tvmaze_id, imdb_id }) {
  const { error } = await supabase
    .from('tvtime_shows')
    .update({ tvmaze_id, imdb_id })
    .eq('id', show_id)
  if (error) throw error
  console.log(`  set tvmaze_id=${tvmaze_id} on show ${show_id}`)
}

async function offsetOwnSeasons(showId, offset) {
  if (!offset) return
  const { data: seasons, error } = await supabase
    .from('tvtime_seasons')
    .select('id, season_number')
    .eq('show_id', showId)
  if (error) throw error
  // Descending order so a +N offset never collides with an existing
  // (show_id, season_number) row it hasn't renumbered yet.
  const ordered = [...seasons].sort((a, b) => b.season_number - a.season_number)
  for (const season of ordered) {
    const { error: updErr } = await supabase
      .from('tvtime_seasons')
      .update({ season_number: season.season_number + offset })
      .eq('id', season.id)
    if (updErr) throw updErr
  }
  console.log(`  offset show ${showId}'s own seasons by +${offset}`)
}

async function applyMerge({ show_ids, target_show_id, target_tvmaze_id, target_season_offset, season_offsets }) {
  // The target's OWN existing seasons may themselves need renumbering (e.g.
  // neither pre-merge row had the real TVmaze season number) — do this before
  // moving any source seasons in, so the two never collide mid-flight.
  await offsetOwnSeasons(target_show_id, target_season_offset ?? 0)

  const sourceIds = show_ids.filter((id) => id !== target_show_id)

  for (const sourceId of sourceIds) {
    const offset = season_offsets[sourceId] ?? 0

    const { data: seasons, error: seasonsErr } = await supabase
      .from('tvtime_seasons')
      .select('id, season_number, name, episode_count, air_date')
      .eq('show_id', sourceId)
    if (seasonsErr) throw seasonsErr

    for (const season of seasons) {
      const newSeasonNumber = season.season_number + offset

      // Move episodes to the target show's season (creating it if it doesn't exist yet),
      // preserving watched/watched_at. Conflicts (episode already exists in the target
      // season) keep whichever copy is already watched=true. episode_count/name/air_date
      // carry over from the source season so a newly created target season isn't left with
      // nulls (those drive the season progress bar in the UI).
      const { data: targetSeason, error: targetSeasonErr } = await supabase
        .from('tvtime_seasons')
        .upsert(
          {
            show_id: target_show_id,
            season_number: newSeasonNumber,
            name: season.name,
            episode_count: season.episode_count,
            air_date: season.air_date,
          },
          { onConflict: 'show_id,season_number', ignoreDuplicates: false },
        )
        .select('id')
        .single()
      if (targetSeasonErr) throw targetSeasonErr

      const { data: episodes, error: episodesErr } = await supabase
        .from('tvtime_episodes')
        .select('episode_number, name, air_date, watched, watched_at')
        .eq('season_id', season.id)
      if (episodesErr) throw episodesErr

      for (const ep of episodes) {
        const { data: existing } = await supabase
          .from('tvtime_episodes')
          .select('id, watched')
          .eq('season_id', targetSeason.id)
          .eq('episode_number', ep.episode_number)
          .maybeSingle()

        if (existing) {
          if (ep.watched && !existing.watched) {
            await supabase
              .from('tvtime_episodes')
              .update({ watched: true, watched_at: ep.watched_at })
              .eq('id', existing.id)
          }
        } else {
          await supabase.from('tvtime_episodes').insert({
            show_id: target_show_id,
            season_id: targetSeason.id,
            episode_number: ep.episode_number,
            name: ep.name,
            air_date: ep.air_date,
            watched: ep.watched,
            watched_at: ep.watched_at,
          })
        }
      }
    }

    const { error: deleteErr } = await supabase.from('tvtime_shows').delete().eq('id', sourceId)
    if (deleteErr) throw deleteErr
    console.log(`  merged show ${sourceId} into ${target_show_id}, deleted the duplicate row`)
  }

  const { error: targetTvmazeIdErr } = await supabase
    .from('tvtime_shows')
    .update({ tvmaze_id: target_tvmaze_id })
    .eq('id', target_show_id)
  if (targetTvmazeIdErr) throw targetTvmazeIdErr
}

async function main() {
  console.log(`Applying ${approved.setTvmazeId.length} direct matches...`)
  for (const entry of approved.setTvmazeId) {
    await applySetTvmazeId(entry)
  }

  console.log(`Applying ${approved.merges.length} merges...`)
  for (const merge of approved.merges) {
    console.log(`  ${merge.name ?? ''}`)
    await applyMerge(merge)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
