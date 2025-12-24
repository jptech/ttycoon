import { cn } from '@/lib/utils'
import type { Session, Therapist, Client, DecisionEvent } from '@/core/types'
import { SessionManager } from '@/core/session'
import { ScheduleManager } from '@/core/schedule'
import { Card, Badge, ProgressBar, Button } from '@/components/ui'
import { Clock, User, Zap, Video, Building, AlertCircle } from 'lucide-react'

export interface SessionPanelProps {
  /** The active session */
  session: Session
  /** The therapist conducting the session */
  therapist: Therapist
  /** The client in the session */
  client: Client
  /** Currently pending decision event, if any */
  decisionEvent?: DecisionEvent
  /** Callback when a decision is made */
  onDecision?: (eventId: string, choiceIndex: number) => void
  /** Additional class name */
  className?: string
}

export function SessionPanel({
  session,
  therapist,
  client,
  decisionEvent,
  onDecision,
  className,
}: SessionPanelProps) {
  const timeRange = ScheduleManager.getSessionTimeRange(session)
  const qualityRating = SessionManager.getQualityRating(session.quality)
  const qualityVariant = SessionManager.getQualityVariant(session.quality)

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-primary/10 -m-4 mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Session in Progress</h3>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4" />
              {timeRange}
            </div>
          </div>
          <Badge variant="info" className="animate-pulse">
            Live
          </Badge>
        </div>
      </div>

      {/* Participants */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Therapist */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Therapist</span>
          </div>
          <div className="font-semibold">{therapist.displayName}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <Zap className="w-4 h-4 text-warning" />
            <span className="text-muted-foreground">Energy:</span>
            <span>{therapist.energy}/{therapist.maxEnergy}</span>
          </div>
        </div>

        {/* Client */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Client</span>
          </div>
          <div className="font-semibold">{client.displayName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {client.conditionCategory} • Session {client.sessionsCompleted + 1}/{client.sessionsRequired}
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          {session.isVirtual ? (
            <>
              <Video className="w-4 h-4 text-muted-foreground" />
              <span>Virtual</span>
            </>
          ) : (
            <>
              <Building className="w-4 h-4 text-muted-foreground" />
              <span>In-Office</span>
            </>
          )}
        </div>
        <div className="text-muted-foreground">
          {session.durationMinutes} min session
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Session Progress</span>
          <span className="text-muted-foreground">{Math.round(session.progress * 100)}%</span>
        </div>
        <ProgressBar value={session.progress * 100} variant="info" size="lg" />
      </div>

      {/* Quality */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Current Quality</span>
          <Badge variant={qualityVariant} size="sm">
            {qualityRating}
          </Badge>
        </div>
        <ProgressBar value={session.quality * 100} variant={qualityVariant} />
      </div>

      {/* Quality Modifiers */}
      {session.qualityModifiers.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Quality Factors</div>
          <div className="space-y-1">
            {session.qualityModifiers.map((modifier, index) => (
              <div
                key={index}
                className={cn(
                  'text-xs flex items-center justify-between py-1 px-2 rounded',
                  modifier.value >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                )}
              >
                <span>{modifier.description}</span>
                <span className="font-mono">
                  {modifier.value >= 0 ? '+' : ''}
                  {Math.round(modifier.value * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Event */}
      {decisionEvent && (
        <div className="border-t border-border pt-4 -mx-4 px-4">
          <div className="flex items-center gap-2 mb-3 text-warning">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">{decisionEvent.title}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{decisionEvent.description}</p>
          <div className="space-y-2">
            {decisionEvent.choices.map((choice, index) => (
              <Button
                key={index}
                variant="secondary"
                size="sm"
                className="w-full justify-start text-left h-auto py-2"
                onClick={() => onDecision?.(decisionEvent.id, index)}
              >
                <span className="flex-1">{choice.text}</span>
                {choice.effects.quality && (
                  <Badge
                    variant={choice.effects.quality >= 0 ? 'success' : 'error'}
                    size="sm"
                  >
                    {choice.effects.quality >= 0 ? '+' : ''}
                    {Math.round(choice.effects.quality * 100)}% quality
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
