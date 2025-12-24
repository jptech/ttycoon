import { cn, formatMoney } from '@/lib/utils'
import type { Session } from '@/core/types'
import { SessionManager, type SessionCompleteResult } from '@/core/session'
import { ScheduleManager } from '@/core/schedule'
import { Modal, ModalFooter, Button, Card, Badge, ProgressBar } from '@/components/ui'
import {
  CheckCircle,
  DollarSign,
  Star,
  Zap,
  TrendingUp,
  Heart,
  Clock,
} from 'lucide-react'

export interface SessionSummaryProps {
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** The completed session */
  session: Session
  /** Session completion results */
  results: SessionCompleteResult
}

export function SessionSummary({ open, onClose, session, results }: SessionSummaryProps) {
  const qualityRating = SessionManager.getQualityRating(session.quality)
  const qualityVariant = SessionManager.getQualityVariant(session.quality)
  const timeRange = ScheduleManager.getSessionTimeRange(session)

  return (
    <Modal open={open} onClose={onClose} title="Session Complete" size="md">
      <div className="space-y-6">
        {/* Success Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-lg font-semibold">Session Completed!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {session.clientName} with {session.therapistName}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Day {session.scheduledDay} • {timeRange}
          </p>
        </div>

        {/* Quality Rating */}
        <Card className="text-center">
          <div className="text-sm text-muted-foreground mb-2">Session Quality</div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="w-6 h-6 text-accent" />
            <span className="text-2xl font-bold">{Math.round(session.quality * 100)}%</span>
          </div>
          <Badge variant={qualityVariant} size="md">
            {qualityRating}
          </Badge>
          <ProgressBar
            value={session.quality * 100}
            variant={qualityVariant}
            className="mt-3"
          />
        </Card>

        {/* Results Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Payment */}
          <Card className="bg-success/5 border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Payment</span>
            </div>
            <div className="text-xl font-bold">{formatMoney(results.paymentAmount)}</div>
            {session.isInsurance && (
              <div className="text-xs text-muted-foreground mt-1">Insurance claim pending</div>
            )}
          </Card>

          {/* XP Gained */}
          <Card className="bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 text-accent mb-1">
              <Star className="w-4 h-4" />
              <span className="text-sm font-medium">XP Gained</span>
            </div>
            <div className="text-xl font-bold">+{results.xpGained} XP</div>
            <div className="text-xs text-muted-foreground mt-1">
              Level {results.therapist.level}
            </div>
          </Card>

          {/* Energy Used */}
          <Card className="bg-warning/5 border-warning/20">
            <div className="flex items-center gap-2 text-warning mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Energy Used</span>
            </div>
            <div className="text-xl font-bold">-{session.energyCost}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {results.therapist.energy}/{results.therapist.maxEnergy} remaining
            </div>
          </Card>

          {/* Client Satisfaction */}
          <Card
            className={cn(
              results.satisfactionChange >= 0
                ? 'bg-success/5 border-success/20'
                : 'bg-error/5 border-error/20'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2 mb-1',
                results.satisfactionChange >= 0 ? 'text-success' : 'text-error'
              )}
            >
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">Satisfaction</span>
            </div>
            <div className="text-xl font-bold">
              {results.satisfactionChange >= 0 ? '+' : ''}
              {results.satisfactionChange}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Now at {results.client.satisfaction}%
            </div>
          </Card>
        </div>

        {/* Client Progress */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-medium">Treatment Progress</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              Session {results.client.sessionsCompleted} of {results.client.sessionsRequired}
            </span>
            <span className="font-medium">
              {Math.round(results.client.treatmentProgress * 100)}%
            </span>
          </div>
          <ProgressBar
            value={results.client.treatmentProgress * 100}
            variant={results.client.status === 'completed' ? 'success' : 'default'}
          />
          {results.client.status === 'completed' && (
            <div className="mt-3 p-2 bg-success/10 rounded-lg text-center">
              <Badge variant="success">Treatment Complete!</Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Client has successfully completed their treatment plan
              </p>
            </div>
          )}
        </Card>

        {/* Decisions Made */}
        {session.decisionsMade.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Key Moments</span>
            </div>
            <div className="space-y-2">
              {session.qualityModifiers
                .filter((m) => m.source.startsWith('decision_'))
                .map((modifier, index) => (
                  <div
                    key={index}
                    className={cn(
                      'text-sm flex items-center justify-between py-2 px-3 rounded',
                      modifier.value >= 0 ? 'bg-success/10' : 'bg-error/10'
                    )}
                  >
                    <span className="text-muted-foreground">{modifier.description}...</span>
                    <Badge variant={modifier.value >= 0 ? 'success' : 'error'} size="sm">
                      {modifier.value >= 0 ? '+' : ''}
                      {Math.round(modifier.value * 100)}%
                    </Badge>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>

      <ModalFooter>
        <Button onClick={onClose}>Continue</Button>
      </ModalFooter>
    </Modal>
  )
}
