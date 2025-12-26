import { cn, formatMoney } from '@/lib/utils'
import type { Session } from '@/core/types'
import { ScheduleManager } from '@/core/schedule'
import { Badge, ProgressBar } from '@/components/ui'
import { Clock, Video, Building, DollarSign, CheckCircle } from 'lucide-react'

export interface SessionCardProps {
  session: Session
  /** Whether to show compact view */
  compact?: boolean
  /** Click handler */
  onClick?: () => void
  /** Additional class name */
  className?: string
}

const statusColors = {
  scheduled: 'border-l-session-scheduled',
  in_progress: 'border-l-session-in-progress',
  completed: 'border-l-session-completed',
  cancelled: 'border-l-session-cancelled',
  conflict: 'border-l-error',
} as const

const statusBadgeVariants = {
  scheduled: 'default',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
  conflict: 'error',
} as const

export function SessionCard({ session, compact = false, onClick, className }: SessionCardProps) {
  const timeRange = ScheduleManager.getSessionTimeRange(session)
  const isActive = session.status === 'in_progress'
  const isCompleted = session.status === 'completed'

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left p-2 rounded-lg border-l-4 bg-card hover:bg-surface-hover transition-all duration-150',
          statusColors[session.status],
          onClick && 'cursor-pointer',
          isActive && 'relative session-active',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{session.clientName}</span>
          {session.isVirtual ? (
            <span className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
              <Video className="w-3 h-3" />
              Virtual
            </span>
          ) : (
            <span className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-accent/15 text-accent">
              <Building className="w-3 h-3" />
              Office
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">{timeRange}</div>
        {isActive && (
          <ProgressBar value={session.progress * 100} size="sm" variant="info" shimmer className="mt-1" />
        )}
      </button>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border-l-4 bg-card border border-border shadow-sm transition-all duration-150',
        statusColors[session.status],
        onClick && 'cursor-pointer hover:shadow-md hover:border-border-subtle',
        isActive && 'relative session-active',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="font-semibold">{session.clientName}</h4>
          <p className="text-sm text-muted-foreground">with {session.therapistName}</p>
        </div>
        <Badge variant={statusBadgeVariants[session.status] as 'default' | 'success' | 'error' | 'info'}>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5" />}
          {session.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="tabular-nums">{timeRange}</span>
          <span className="text-xs">({session.durationMinutes} min)</span>
        </div>

        <div className="flex items-center gap-2">
          {session.isVirtual ? (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium bg-info/15 text-info">
              <Video className="w-4 h-4" />
              Virtual Session
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium bg-accent/15 text-accent">
              <Building className="w-4 h-4" />
              In-Office
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <DollarSign className="w-4 h-4" />
          <span className="tabular-nums">{formatMoney(session.payment)}</span>
          {session.isInsurance && (
            <Badge variant="outline" size="sm">
              Insurance
            </Badge>
          )}
        </div>
      </div>

      {/* Progress for in-progress sessions */}
      {isActive && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Session Progress</span>
            <span className="tabular-nums">{Math.round(session.progress * 100)}%</span>
          </div>
          <ProgressBar value={session.progress * 100} variant="info" shimmer />
        </div>
      )}

      {/* Quality indicator for completed sessions */}
      {isCompleted && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-success check-pop" />
              Session Quality
            </span>
            <span className="tabular-nums">{Math.round(session.quality * 100)}%</span>
          </div>
          <ProgressBar
            value={session.quality * 100}
            variant={session.quality >= 0.7 ? 'success' : session.quality >= 0.4 ? 'warning' : 'error'}
          />
        </div>
      )}
    </div>
  )
}
