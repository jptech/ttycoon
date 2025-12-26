import { cn } from '@/lib/utils'
import type { Session } from '@/core/types'
import { ScheduleManager } from '@/core/schedule'
import { SessionCard } from './SessionCard'
import { Plus } from 'lucide-react'

export interface TimeSlotProps {
  /** Hour of the day (8-17) */
  hour: number
  /** Session in this slot, if any */
  session?: Session
  /** Whether the slot is available for booking */
  isAvailable?: boolean
  /** Whether this is the current hour */
  isCurrent?: boolean
  /** Whether this slot is in the past */
  isPast?: boolean
  /** Whether this slot is selected */
  isSelected?: boolean
  /** Click handler for empty slots */
  onSlotClick?: () => void
  /** Click handler for sessions */
  onSessionClick?: (session: Session) => void
  /** Additional class name */
  className?: string
}

export function TimeSlot({
  hour,
  session,
  isAvailable = true,
  isCurrent = false,
  isPast = false,
  isSelected = false,
  onSlotClick,
  onSessionClick,
  className,
}: TimeSlotProps) {
  const formattedHour = ScheduleManager.formatHour(hour)

  return (
    <div
      className={cn(
        'relative flex gap-3 py-2 px-3 min-h-[72px] border-b border-border',
        isCurrent && 'bg-primary/5',
        isPast && !session && 'opacity-50',
        // Left border color for session type
        session && 'border-l-3',
        session?.isVirtual && 'border-l-info',
        session && !session.isVirtual && 'border-l-warning',
        className
      )}
    >
      {/* Hour label */}
      <div className="w-16 shrink-0 text-sm text-muted-foreground pt-1">{formattedHour}</div>

      {/* Slot content */}
      <div className="flex-1 min-w-0">
        {session ? (
          <SessionCard
            session={session}
            compact
            onClick={onSessionClick ? () => onSessionClick(session) : undefined}
          />
        ) : isAvailable ? (
          <button
            onClick={onSlotClick}
            className={cn(
              'w-full h-full min-h-[56px] rounded-lg border-2 border-dashed transition-colors',
              'flex items-center justify-center gap-2 text-sm',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground'
            )}
          >
            <Plus className="w-4 h-4" />
            <span>Book session</span>
          </button>
        ) : isPast ? (
          <div className="w-full h-full min-h-[56px] rounded-lg bg-muted/20 flex items-center justify-center text-sm text-muted-foreground/50">
            {/* Empty for past slots */}
          </div>
        ) : (
          <div className="w-full h-full min-h-[56px] rounded-lg bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
            Unavailable
          </div>
        )}
      </div>
    </div>
  )
}
