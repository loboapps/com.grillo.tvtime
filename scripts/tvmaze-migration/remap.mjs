// ONE-OFF SCRIPT — part of the TMDB -> TVmaze migration
// (docs/superpowers/plans/2026-07-12-tvmaze-migration.md, Fase 10).
// Delete this whole scripts/tvmaze-migration/ directory once Fase 15 runs.
//
// Resolves tvmaze_id + imdb_id for every show in tvtime_shows, using the
// existing TMDB access as a bridge (TMDB external_ids -> imdb_id -> TVmaze
// lookup-by-imdb). Writes nothing to the database — only produces a report
// for human review. Run `node scripts/tvmaze-migration/apply-remap.mjs`
// afterwards, and only on entries you've approved.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TMDB_API_KEY=... node scripts/tvmaze-migration/remap.mjs

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TVMAZE_BASE = 'https://api.tvmaze.com'
const OUT_DIR = dirname(fileURLToPath(import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tmdbExternalIds(tmdbId) {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`)
  if (!res.ok) throw new Error(`TMDB external_ids ${tmdbId} -> HTTP ${res.status}`)
  return res.json()
}

async function tvmazeLookupByImdb(imdbId) {
  const res = await fetch(`${TVMAZE_BASE}/lookup/shows?imdb=${imdbId}`, { redirect: 'follow' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`TVmaze lookup ${imdbId} -> HTTP ${res.status}`)
  return res.json()
}

async function tvmazeSearchByName(name) {
  const res = await fetch(`${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`TVmaze search "${name}" -> HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const { data: shows, error } = await supabase
    .from('tvtime_shows')
    .select('id, tmdb_id, name')
    .order('name')
  if (error) throw error

  const resolvedAuto = []
  const pendingManual = []

  let processed = 0
  for (const show of shows) {
    try {
      const externalIds = await tmdbExternalIds(show.tmdb_id)
      const imdbId = externalIds.imdb_id ?? null

      let tvmazeMatch = null
      if (imdbId) {
        const lookup = await tvmazeLookupByImdb(imdbId)
        if (lookup) tvmazeMatch = lookup
      }

      if (tvmazeMatch) {
        resolvedAuto.push({
          show_id: show.id,
          tmdb_id: show.tmdb_id,
          name: show.name,
          imdb_id: imdbId,
          tvmaze_id: tvmazeMatch.id,
          tvmaze_name: tvmazeMatch.name,
        })
      } else {
        // Fallback: name search — never auto-picked, always surfaced for manual review.
        const candidates = await tvmazeSearchByName(show.name)
        pendingManual.push({
          show_id: show.id,
          tmdb_id: show.tmdb_id,
          name: show.name,
          imdb_id: imdbId,
          candidates: candidates.slice(0, 5).map((c) => ({
            tvmaze_id: c.show.id,
            name: c.show.name,
            premiered: c.show.premiered,
            score: c.score,
          })),
        })
      }
    } catch (err) {
      pendingManual.push({ show_id: show.id, tmdb_id: show.tmdb_id, name: show.name, error: err.message })
    }
    processed++
    if (processed % 25 === 0) {
      console.log(`  ...${processed}/${shows.length} processed`)
    }
    await sleep(550) // stay under TVmaze's 20 req/10s, and be polite to TMDB
  }

  // Fusão: mais de uma linha do TMDB resolvendo pro mesmo tvmaze_id (antologias divididas).
  const byTvmazeId = new Map()
  for (const r of resolvedAuto) {
    if (!byTvmazeId.has(r.tvmaze_id)) byTvmazeId.set(r.tvmaze_id, [])
    byTvmazeId.get(r.tvmaze_id).push(r)
  }
  const mergeCandidates = [...byTvmazeId.values()].filter((group) => group.length > 1)

  const report = {
    generated_at: new Date().toISOString(),
    total: shows.length,
    resolved_auto: resolvedAuto.length,
    pending_manual: pendingManual.length,
    merge_candidates: mergeCandidates.length,
    resolvedAuto,
    pendingManual,
    mergeCandidates,
  }

  writeFileSync(join(OUT_DIR, 'remap-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`Total: ${shows.length}`)
  console.log(`Resolvido automático: ${resolvedAuto.length}`)
  console.log(`Pendente revisão manual: ${pendingManual.length}`)
  console.log(`Candidatos a fusão (mesmo tvmaze_id): ${mergeCandidates.length}`)
  console.log('Nada foi gravado no banco. Revise scripts/tvmaze-migration/remap-report.json, depois rode apply-remap.mjs.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exitCode = 1
})
