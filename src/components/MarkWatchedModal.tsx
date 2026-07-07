import type { MarkWatchedModalProps } from '@/types/tvtime'

export function MarkWatchedModal({ onMarkJustThis, onMarkAllPrevious, onCancel }: MarkWatchedModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onCancel}>
      <div className="w-full bg-tvtime-700 rounded-t-2xl p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-tvtime-100 text-sm text-center mb-2">
          Existem episódios anteriores não vistos. O que deseja fazer?
        </p>
        <button
          onClick={onMarkAllPrevious}
          className="w-full text-left text-tvtime-100 py-3 px-4 rounded-lg hover:bg-tvtime-600"
        >
          Marcar todos os episódios anteriores como vistos
        </button>
        <button
          onClick={onMarkJustThis}
          className="w-full text-left text-tvtime-100 py-3 px-4 rounded-lg hover:bg-tvtime-600"
        >
          Marcar apenas este episódio
        </button>
      </div>
    </div>
  )
}
