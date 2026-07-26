import { useState } from 'react'
import { tvtimeWriteService } from '@/services/tvtimeService'
import { hasEarlierUnwatchedEpisode } from '@/utils/hasEarlierUnwatchedEpisode'
import { isPreviewId } from '@/utils/previewIds'
import type { ShowSeasonDetail } from '@/types/tvtime'

export function useEpisodeWatchActions(
  seasons: ShowSeasonDetail[] | null | undefined,
  refresh: () => Promise<void>,
  showToast: (message: string) => void,
  // Only needed for preview (not-yet-added) rows: adds the show, then resolves
  // the preview season/episode into its real DB counterpart.
  ensureAdded?: () => Promise<ShowSeasonDetail[]>,
) {
  const [pendingMark, setPendingMark] = useState<string | null>(null)

  function cancelPendingMark() {
    setPendingMark(null)
  }

  async function resolveEpisodeId(
    episodeId: string,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<{ episodeId: string; seasons: ShowSeasonDetail[] | null | undefined }> {
    if (!isPreviewId(episodeId)) {
      return { episodeId, seasons }
    }
    if (!ensureAdded) throw new Error('Cannot add show from this context')
    const freshSeasons = await ensureAdded()
    const match = freshSeasons
      .find((s) => s.season_number === seasonNumber)
      ?.episodes.find((e) => e.episode_number === episodeNumber)
    if (!match) throw new Error('Episode not found after adding show')
    return { episodeId: match.episode_id, seasons: freshSeasons }
  }

  async function handleToggleEpisode(
    episodeId: string,
    currentlyWatched: boolean,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    // Preview rows are always unwatched, so this branch only ever runs for real episodes.
    if (currentlyWatched) {
      try {
        await tvtimeWriteService.unwatchEpisode(episodeId)
        await refresh()
      } catch (err) {
        console.error(err)
        showToast("Couldn't update the episode.")
      }
      return
    }

    try {
      const resolved = await resolveEpisodeId(episodeId, seasonNumber, episodeNumber)
      if (resolved.seasons && hasEarlierUnwatchedEpisode(resolved.seasons, seasonNumber, episodeNumber)) {
        setPendingMark(resolved.episodeId)
        return
      }
      await tvtimeWriteService.watchEpisode(resolved.episodeId)
      await refresh()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episode.")
    }
  }

  async function handleMarkJustThis() {
    if (!pendingMark) return
    try {
      await tvtimeWriteService.watchEpisode(pendingMark)
      setPendingMark(null)
      await refresh()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episode.")
    }
  }

  async function handleMarkAllPrevious() {
    if (!pendingMark) return
    try {
      await tvtimeWriteService.watchEpisode(pendingMark, true)
      setPendingMark(null)
      await refresh()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the episodes.")
    }
  }

  async function handleToggleSeason(seasonId: string, currentlyFullyWatched: boolean, seasonNumber: number) {
    try {
      let realSeasonId = seasonId
      if (isPreviewId(seasonId)) {
        if (!ensureAdded) throw new Error('Cannot add show from this context')
        const freshSeasons = await ensureAdded()
        const match = freshSeasons.find((s) => s.season_number === seasonNumber)
        if (!match) throw new Error('Season not found after adding show')
        realSeasonId = match.season_id
      }
      await tvtimeWriteService.watchSeason(realSeasonId, !currentlyFullyWatched)
      await refresh()
    } catch (err) {
      console.error(err)
      showToast("Couldn't update the season.")
    }
  }

  return {
    pendingMark,
    cancelPendingMark,
    handleToggleEpisode,
    handleMarkJustThis,
    handleMarkAllPrevious,
    handleToggleSeason,
  }
}
