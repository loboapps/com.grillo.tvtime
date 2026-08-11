import { useCallback, useEffect, useState } from 'react'
import { ScheduleRow } from '@/components/ScheduleRow'
import { Skeleton } from '@/components/Skeleton'
import { tvtimeService } from '@/services/tvtimeService'
import { groupScheduleEntries } from '@/utils/groupScheduleEntries'
import type { ScheduleGroup } from '@/utils/groupScheduleEntries'

function SchedulePageSkeleton() {
  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-3 border-b border-tvtime-700">
          <Skeleton className="w-16 h-24" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SchedulePage() {
  const [groups, setGroups] = useState<ScheduleGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const entries = await tvtimeService.loadSchedule()
      setGroups(groupScheduleEntries(entries, new Date()))
    } catch (err) {
      console.error(err)
      setError("Couldn't load your schedule. Check your connection and try again.")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="min-h-screen bg-tvtime-900 pb-20 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Something went wrong</p>
        <p className="text-tvtime-300 text-sm mb-6">{error}</p>
        <button
          onClick={() => load()}
          className="bg-tvtime-100 text-tvtime-900 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!groups) {
    return <SchedulePageSkeleton />
  }

  if (groups.length === 0) {
    return (
      <div className="min-h-screen bg-tvtime-900 pb-20 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-tvtime-100 font-semibold mb-2">Nothing scheduled</p>
        <p className="text-tvtime-300 text-sm">No upcoming episodes for your tracked shows.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tvtime-900 pb-20">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="py-3 flex justify-center">
            <span className="bg-tvtime-600 text-tvtime-100 text-sm font-bold uppercase tracking-wide px-5 py-2.5 rounded-full">
              {group.label}
            </span>
          </div>
          {group.entries.map((entry) => (
            <ScheduleRow
              key={entry.episode_id}
              entry={entry}
              showDate={group.label === 'This Month' || group.label === 'In the Future'}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
