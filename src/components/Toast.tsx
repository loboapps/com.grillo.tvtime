import type { ToastProps } from '@/types/tvtime'

export function Toast({ message, variant }: ToastProps) {
  return (
    <div
      className={`fixed bottom-20 left-4 right-4 rounded-lg px-4 py-3 text-sm font-semibold text-center z-50 ${
        variant === 'error' ? 'bg-red-600 text-white' : 'bg-tvtime-100 text-tvtime-900'
      }`}
    >
      {message}
    </div>
  )
}
