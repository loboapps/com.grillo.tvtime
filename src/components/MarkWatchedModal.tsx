import type { MarkWatchedModalProps } from '@/types/tvtime'

export function MarkWatchedModal({ onMarkJustThis, onMarkAllPrevious, onCancel }: MarkWatchedModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onCancel}>
      <div className="w-full bg-tvtime-700 rounded-t-2xl p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-tvtime-100 text-sm text-center mb-2">What you want?</p>
        <button
          onClick={onMarkAllPrevious}
          className="w-full text-center text-tvtime-900 bg-yellow-500 font-semibold py-3 px-4 rounded-lg"
        >
          Mark older EPs as watched
        </button>
        <button
          onClick={onMarkJustThis}
          className="w-full text-center text-tvtime-100 bg-tvtime-600 font-semibold py-3 px-4 rounded-lg"
        >
          Mark only this EP
        </button>
      </div>
    </div>
  )
}
