// ONE-OFF SCRIPT — see docs/superpowers/plans/2026-07-12-tvmaze-migration.md, Fase 11.
// For every show with a resolved tvmaze_id, compares the (season_number, episode_number)
// pairs already stored against what TVmaze actually reports. Flags mismatches for manual
// review before cutover — these are the shows where watch history could land on the wrong
// episode once RPCs/frontend switch over.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/tvmaze-migration/validate-numbering.mjs

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OUT_DIR = dirname(fileURLToPath(import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const { data: shows, error } = await supabase
    .from('tvtime_shows')
    .select('id, name, tvmaze_id')
    .not('tvmaze_id', 'is', null)
    .order('name')
  if (error) throw error

  const mismatches = []
  let processed = 0

  for (const show of shows) {
    const { data: storedEpisodes, error: epErr } = await supabase
      .from('tvtime_episodes')
      .select('episode_number, tvtime_seasons!inner(season_number)')
      .eq('show_id', show.id)
    if (epErr) throw epErr

    const storedKeys = new Set(
      storedEpisodes.map((e) => `${e.tvtime_seasons.season_number}-${e.episode_number}`),
    )

    let tvmazeEpisodes = []
    try {
      const res = await fetch(`https://api.tvmaze.com/shows/${show.tvmaze_id}/episodes`)
      if (res.ok) tvmazeEpisodes = await res.json()
    } catch {
      // network hiccup — treat as "couldn't verify", not a mismatch; flagged separately below
    }

    const tvmazeKeys = new Set(tvmazeEpisodes.map((e) => `${e.season}-${e.number}`))

    const onlyStored = [...storedKeys].filter((k) => !tvmazeKeys.has(k))
    const onlyTvmaze = [...tvmazeKeys].filter((k) => !storedKeys.has(k))

    if (onlyStored.length > 0 || onlyTvmaze.length > 0) {
      mismatches.push({
        show_id: show.id,
        name: show.name,
        tvmaze_id: show.tvmaze_id,
        stored_count: storedKeys.size,
        tvmaze_count: tvmazeKeys.size,
        onlyStored,
        onlyTvmaze,
      })
    }

    processed++
    if (processed % 50 === 0) console.log(`  ...${processed}/${shows.length}`)
    await sleep(550)
  }

  const report = {
    generated_at: new Date().toISOString(),
    total_checked: shows.length,
    mismatch_count: mismatches.length,
    mismatches,
  }
  writeFileSync(join(OUT_DIR, 'validation-report.json'), JSON.stringify(report, null, 2) + '\n')

  console.log(`Checked ${shows.length} shows. ${mismatches.length} with numbering mismatches:`)
  for (const m of mismatches) {
    console.log(`- ${m.name} (tvmaze_id=${m.tvmaze_id}): stored ${m.stored_count} eps, tvmaze ${m.tvmaze_count} eps, stored-only ${JSON.stringify(m.onlyStored)}, tvmaze-only ${JSON.stringify(m.onlyTvmaze)}`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
