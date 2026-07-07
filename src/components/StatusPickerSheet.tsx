import type { ShowStatus, StatusPickerSheetProps } from '@/types/tvtime'

const OPTIONS: { value: ShowStatus; label: string }[] = [
  { value: 'watching', label: 'Estou vendo' },
  { value: 'want_to_see', label: 'Quero ver' },
  { value: 'finished', label: 'Terminei' },
  { value: 'dropped', label: 'Desisti' },
]

export function StatusPickerSheet({ onSelect, onCancel }: StatusPickerSheetProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onCancel}>
      <div
        className="w-full bg-tvtime-700 rounded-t-2xl p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="w-full text-left text-tvtime-100 py-3 px-4 rounded-lg hover:bg-tvtime-600"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
