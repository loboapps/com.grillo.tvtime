import { useState } from 'react'
import { tvtimeWriteService } from '@/services/tvtimeService'
import { hasEarlierUnwatchedEpisode } from '@/utils/hasEarlierUnwatchedEpisode'
import type { ShowSeasonDetail } from '@/types/tvtime'

export function useEpisodeWatchActions(
  seasons: ShowSeasonDetail[] | null | undefined,
  refresh: () => Promise<void>,
  showToast: (message: string) => void,
) {
  const [pendingMark, setPendingMark] = useState<string | null>(null)

  function cancelPendingMark() {
    setPendingMark(null)
  }

  async function handleToggleEpisode(
    episodeId: string,
    currentlyWatched: boolean,
    seasonNumber: number,
    episodeNumber: number,
  ) {
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

    if (seasons && hasEarlierUnwatchedEpisode(seasons, seasonNumber, episodeNumber)) {
      setPendingMark(episodeId)
      return
    }

    try {
      await tvtimeWriteService.watchEpisode(episodeId)
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

  async function handleToggleSeason(seasonId: string, currentlyFullyWatched: boolean) {
    try {
      await tvtimeWriteService.watchSeason(seasonId, !currentlyFullyWatched)
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
