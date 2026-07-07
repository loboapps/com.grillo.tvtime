import type { SkeletonProps } from '@/types/tvtime'

export function Skeleton({ className }: SkeletonProps) {
  return <div className={`animate-pulse bg-tvtime-700 rounded ${className ?? ''}`} />
}
