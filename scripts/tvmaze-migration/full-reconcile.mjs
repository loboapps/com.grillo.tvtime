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

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }

// A handful of episode titles differ between TMDB and TVmaze in ways no
// generic rule can safely cover (typos, censorship, one-off suffixes) —
// each pairing below was confirmed by exact air-date match before adding.
const TITLE_ALIASES = {
  'Hurricane! (III)': 'Hurricane!', // American Dad! (215), stored has a stray "(III)" suffix; only one episode exists on either side, air date 2011-10-02 confirms it
  'Choosey Wives Choose Smith': 'Choosy Wives Choose Smith', // American Dad! (215), spelling variant, air date 2008-11-02 confirms it
  "Holy S***, Jeff's Back!": "Holy Shit, Jeff's Back!", // American Dad! (215), censorship variant, air date 2015-05-18 confirms it
  'Gifted Me Liberty': 'Gift Me Liberty', // American Dad! (215), spelling variant, air date 2016-06-13 confirms it
  "Dancin' A-With My Cells": "Dancin' A-with My Cell", // American Dad! (215), pluralization variant, air date 2021-06-07 confirms it
  // NOVA (3321) — position-changing variants, each confirmed by exact air-date match
  'T. rex Exposed': 'T-Rex Exposed',
  'Little Creatures Who Run the World': 'Ants: Little Creatures Who Run the World',
  'Human Nature / Gene-Editing Reality Check': 'Human Nature / CRISPR Gene-Editing Reality Check',
  'Computers v. Crime': 'Computer v. Crime',
  // NOVA (3321) — already at the correct season/episode, title format differs only; alias so the
  // reconcile report doesn't misreport these as needing attention
  'Plague Fighters': 'Ebola: The Plague Fighters',
  'Secrets of the Mind': 'Secrets of the Mind (aka Phantoms in the Brain)',
  'Origins: Earth is Born': 'Origins (1): Earth is Born',
  'Origins: How Life Began': 'Origins (2): How Life Began',
  'Origins: Where Are the Aliens?': 'Origins (3): Where Are the Aliens?',
  'Origins: Back to the Beginning': 'Origins (4): Back to the Beginning',
  'The Four Winged Dinosaur': 'The Four-Winged Dinosaur',
  'Absolute Zero: The Race for Absolute Zero': 'Absolute Zero: The Race for Absolute Zero (2)',
  'Hunting The Hidden Dimension': 'Fractals: Hunting the Hidden Dimension',
  'Your Brain: Perception Deception (1)': 'Your Brain: Perception Deception',
  "Your Brain: Who's in Control? (2)": "Your Brain: Who's in Control?",
  'Easter Island Origins': 'Easter Islands Origins',
  // NOVA (3321) — these were sitting in another episode's real target slot
  // (blocking the apply from completing); each confirmed by exact air-date match
  'The Tsetse Trap': 'The Tse Tse Trap',
  'Laser : Light of the 21st Century': 'Light of the 21st Century',
  'The Final Frontier': 'The Final Frontier (2)',
  "The Hunt for China's Dinosaurs (1)": "The Hunt for China's Dinosaurs",
  'The Chip vs. the Chess Master': 'The Chip vs. the Chessmaster',
  'Secrets of Lost Empires: Colosseum (4)': 'Secrets of Lost Empires (4): Colosseum',
  'The Road to Happiness. : The Life and Times of Henry Ford': 'Road to Happiness',
  'One Small Step': 'One Small Step (1)',
  'Secrets of Lost Empires: Obelisk (3)': 'Secrets of Lost Empires (3): Obelisk',
  'Secrets of Lost Empires: Inca (2)': 'Secrets of Lost Empires (2): Inca',
  'Secrets of Lost Empires: Stonehenge (1)': 'Secrets of Lost Empires (1): Stonehenge',
  // Unsolved Mysteries (40484), confirmed by air date / already-correct-position match
  'Berkshires UFO': "Berkshire's UFO",
  'Washington Inside Murder': 'Washington Insider Murder',
  // Married... with Children (499), confirmed by air date / already-correct-position match
  'Poke High': 'Poke High (aka The Red Grange Story)',
  'The Camping Show': 'The Camping Show (aka A Period Piece)',
  "Can't Dance, Don't Ask Me": "Can't Dance, Don't Ask Me (aka Kelly's Dance)",
  "You Gotta Know When to Fold 'Em (1)": "You Gotta Know When to Hold 'Em (1)", // stored name is a straight typo -- TMDB has both parts titled "Fold 'Em"; air date 1990-02-11 confirms this is really part 1 ("Hold 'Em")
  'What Goes Around Came Around': 'What Goes Around Comes Around',
  'Dances With Weezy': 'Dances with Weezie',
  'The Desperate Half-Hour': 'The Desperate Half-Hour (1)',
  'How to Marry a Moron': 'How to Marry a Moron (2)',
  'Rain Girl': 'Raingirl',
  // Star Wars Rebels (117) — TVmaze tracks the series finale as one combined episode;
  // TMDB split it into 2 parts. Kept our part-1 row (already correctly positioned at
  // 4-15) and deleted the redundant part-2 row (same content, same air date, both watched).
  'Family Reunion - and Farewell (1)': 'Family Reunion – and Farewell',
}

// Multi-part episode titles get formatted very differently between TMDB and
// TVmaze ("Foo (1)" vs "Foo: Part 1" vs "Foo Pt. 1" vs "Foo (I)") — normalize
// every variant down to "foo 1" so they compare equal regardless of source.
function normalize(name) {
  let n = (TITLE_ALIASES[name] || name || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/&/g, ' and ')
    .replace(/-/g, '')
    .replace(/:\s*part\s+(\d+)/gi, ' $1')
    .replace(/\bpart\s+(\d+)/gi, ' $1')
    .replace(/\bpt\.?\s*(\d+)(\s*of\s*\d+)?/gi, ' $1')
    .replace(/\(([ivx]+)\)/gi, (_, roman) => ` ${ROMAN[roman.toLowerCase()] ?? roman}`)
    .replace(/\((\d+)\)/g, ' $1')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|an?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return n
}

// PostgREST caps rows-per-request (commonly 1000) regardless of .select() —
// a show with more stored episodes than that would silently lose the tail
// of the list without paging through with .range().
async function fetchAllEpisodes(showId) {
  const pageSize = 1000
  let page = 0
  const all = []
  for (;;) {
    const { data, error } = await supabase
      .from('tvtime_episodes')
      .select('id, episode_number, name, air_date, watched, watched_at, tvtime_seasons!inner(id, season_number)')
      .eq('show_id', showId)
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return all
}

async function main() {
  const { data: show, error: showErr } = await supabase
    .from('tvtime_shows')
    .select('id, name')
    .eq('tvmaze_id', tvmazeId)
    .single()
  if (showErr) throw showErr

  const storedEpisodes = await fetchAllEpisodes(show.id)

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
