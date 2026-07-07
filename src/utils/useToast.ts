import { useState, useCallback, useRef, useEffect } from 'react'

interface ToastState {
  message: string
  variant: 'error' | 'success'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, variant: 'error' | 'success' = 'error') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ message, variant })
    timeoutRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { toast, showToast }
}
