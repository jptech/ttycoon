import type { BookingSuggestion, MatchQuality } from '@/core/schedule'
import type { Client, Therapist } from '@/core/types'
import { ScheduleManager } from '@/core/schedule'
import { Button, Badge } from '@/components/ui'
import { Calendar, Clock, User, Video, Building, Star, AlertTriangle, X, Repeat, Sparkles, ThumbsUp, Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const MATCH_QUALITY_STYLES: Record<MatchQuality, { icon: LucideIcon; label: string; className: string }> = {
  excellent: {
    icon: Sparkles,
    label: 'Excellent Match',
    className: 'text-success',
  },
  good: {
    icon: ThumbsUp,
    label: 'Good Match',
    className: 'text-primary',
  },
  fair: {
    icon: Check,
    label: 'Available',
    className: 'text-muted-foreground',
  },
}

export interface BookingSuggestionCardProps {
  suggestion: BookingSuggestion
  client: Client
  therapist: Therapist
  currentDay: number
  onBookNow: (suggestion: BookingSuggestion) => void
  onDismiss: (suggestionId: string) => void
  compact?: boolean
}

const URGENCY_STYLES = {
  overdue: {
    bg: 'bg-error/10',
    border: 'border-error/30',
    badge: 'error' as const,
    label: 'Overdue',
  },
  due_soon: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    badge: 'warning' as const,
    label: 'Due Soon',
  },
  normal: {
    bg: 'bg-surface-elevated',
    border: 'border-border',
    badge: 'default' as const,
    label: 'Suggested',
  },
}

// Format interval for display
function formatInterval(days: number): string {
  if (days === 7) return 'weekly'
  if (days === 14) return 'biweekly'
  if (days === 30) return 'monthly'
  return `every ${days} days`
}

export function BookingSuggestionCard({
  suggestion,
  client,
  therapist,
  currentDay,
  onBookNow,
  onDismiss,
  compact = false,
}: BookingSuggestionCardProps) {
  const urgencyStyle = URGENCY_STYLES[suggestion.urgency]
  const daysUntil = suggestion.suggestedDay - currentDay
  const dayLabel = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `Day ${suggestion.suggestedDay}`
  const hasRecurring = suggestion.suggestedRecurringCount > 1
  const bookButtonText = hasRecurring
    ? `Book ${suggestion.suggestedRecurringCount} Sessions`
    : 'Book Session'

  if (compact) {
    const matchStyle = MATCH_QUALITY_STYLES[suggestion.matchBreakdown.quality]
    const MatchIcon = matchStyle.icon

    return (
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg border',
          urgencyStyle.bg,
          urgencyStyle.border
        )}
      >
        {/* Urgency indicator */}
        {suggestion.urgency !== 'normal' && (
          <AlertTriangle className={cn(
            'w-4 h-4 shrink-0',
            suggestion.urgency === 'overdue' ? 'text-error' : 'text-warning'
          )} />
        )}

        {/* Match quality indicator */}
        <MatchIcon className={cn('w-3.5 h-3.5 shrink-0', matchStyle.className)} aria-label={matchStyle.label} />

        {/* Client name */}
        <span className="font-medium text-sm truncate flex-1">{client.displayName}</span>

        {/* Quick info */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {dayLabel} {ScheduleManager.formatHour(suggestion.suggestedHour)}
          {hasRecurring && ` • ${suggestion.suggestedRecurringCount}×`}
        </span>

        {/* Actions */}
        <Button size="sm" variant="primary" onClick={() => onBookNow(suggestion)}>
          {hasRecurring ? `Book ${suggestion.suggestedRecurringCount}` : 'Book'}
        </Button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="p-1 rounded hover:bg-surface-hover text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        urgencyStyle.bg,
        urgencyStyle.border
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant={urgencyStyle.badge} size="sm">
            {urgencyStyle.label}
          </Badge>
          {suggestion.isPreferredSlot && (
            <span className="flex items-center gap-1 text-xs text-success">
              <Star className="w-3 h-3 fill-current" />
              Preferred
            </span>
          )}
        </div>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="p-1 rounded hover:bg-surface-hover text-muted-foreground"
          aria-label="Dismiss suggestion"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Client */}
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{client.displayName}</span>
        <span className="text-xs text-muted-foreground">
          {client.conditionCategory}
        </span>
      </div>

      {/* Match Quality */}
      {(() => {
        const matchStyle = MATCH_QUALITY_STYLES[suggestion.matchBreakdown.quality]
        const MatchIcon = matchStyle.icon
        return (
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('flex items-center gap-1', matchStyle.className)}>
              <MatchIcon className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{matchStyle.label}</span>
            </div>
            {suggestion.matchBreakdown.matchReasons.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {suggestion.matchBreakdown.matchReasons.slice(0, 2).join(' • ')}
              </span>
            )}
          </div>
        )
      })()}

      {/* Suggestion details */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dayLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{ScheduleManager.formatHour(suggestion.suggestedHour)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="w-3.5 h-3.5" />
          <span className="truncate">{therapist.displayName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {suggestion.isVirtual ? (
            <>
              <Video className="w-3.5 h-3.5" />
              <span>Virtual</span>
            </>
          ) : (
            <>
              <Building className="w-3.5 h-3.5" />
              <span>In-office</span>
            </>
          )}
        </div>
      </div>

      {/* Follow-up context */}
      {suggestion.followUpInfo.daysUntilDue !== null && (
        <p className="text-xs text-muted-foreground mb-3">
          {suggestion.followUpInfo.isOverdue
            ? `${Math.abs(suggestion.followUpInfo.daysUntilDue)} days overdue for follow-up`
            : `Follow-up due in ${suggestion.followUpInfo.daysUntilDue} days`}
          {' '}({suggestion.followUpInfo.remainingSessions} sessions remaining)
        </p>
      )}

      {/* Recurring recommendation */}
      {hasRecurring && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Repeat className="w-3.5 h-3.5" />
          <span>
            Recommended: {suggestion.suggestedRecurringCount} sessions {formatInterval(suggestion.suggestedIntervalDays)}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => onBookNow(suggestion)}
        >
          {bookButtonText}
        </Button>
      </div>
    </div>
  )
}
