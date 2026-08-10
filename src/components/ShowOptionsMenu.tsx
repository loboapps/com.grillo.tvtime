import type { ShowOptionsMenuProps } from '@/types/tvtime'
import { icons } from '@/utils/icons'

export function ShowOptionsMenu({ isDropped, onRefresh, onToggleDropped, onCancel }: ShowOptionsMenuProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onCancel}>
      <div className="w-full bg-tvtime-700 rounded-t-2xl p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onRefresh}
          className="w-full flex items-center gap-3 text-tvtime-100 bg-tvtime-600 font-semibold py-3 px-4 rounded-lg"
        >
          <icons.refresh size={20} />
          Refresh
        </button>
        <button
          onClick={onToggleDropped}
          className="w-full flex items-center gap-3 text-tvtime-100 bg-tvtime-600 font-semibold py-3 px-4 rounded-lg"
        >
          {isDropped ? <icons.eye size={20} /> : <icons.eyeOff size={20} />}
          {isDropped ? 'Resume Watching' : 'Stop Watching'}
        </button>
      </div>
    </div>
  )
}
