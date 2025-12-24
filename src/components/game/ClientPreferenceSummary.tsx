import type { Client } from '@/core/types'
import { Badge, Card } from '@/components/ui'
import { Video, Building, Clock, Calendar, AlertTriangle } from 'lucide-react'

export interface ClientPreferenceSummaryProps {
  client: Client
  className?: string
}

const TIME_LABELS: Record<string, string> = {
  morning: 'Morning (8am-12pm)',
  afternoon: 'Afternoon (12pm-4pm)',
  evening: 'Evening (4pm-6pm)',
  any: 'Any time',
}

const FREQUENCY_LABELS: Record<string, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

export function ClientPreferenceSummary({ client, className }: ClientPreferenceSummaryProps) {
  const getCertLabel = () => {
    if (client.isMinor) return 'Children Certified'
    if (client.isCouple) return 'Couples Certified'
    if (client.requiredCertification) {
      return client.requiredCertification.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }
    return null
  }

  const certLabel = getCertLabel()

  return (
    <Card className={className}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{client.displayName}</h3>
            <p className="text-sm text-muted-foreground">
              {client.conditionType} - Severity {client.severity}/10
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {client.sessionsCompleted}/{client.sessionsRequired} sessions
            </div>
            {client.status === 'waiting' && (
              <div className="text-xs text-warning">
                Waiting {client.daysWaiting} days
              </div>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div className="flex flex-wrap gap-2">
          {/* Virtual/In-person */}
          <Badge
            variant={client.prefersVirtual ? 'info' : 'warning'}
            className="flex items-center gap-1.5"
          >
            {client.prefersVirtual ? (
              <>
                <Video className="w-3.5 h-3.5" />
                Prefers Virtual
              </>
            ) : (
              <>
                <Building className="w-3.5 h-3.5" />
                Prefers In-Office
              </>
            )}
          </Badge>

          {/* Time preference */}
          <Badge variant="outline" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {TIME_LABELS[client.preferredTime] || client.preferredTime}
          </Badge>

          {/* Frequency */}
          <Badge variant="outline" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {FREQUENCY_LABELS[client.preferredFrequency] || client.preferredFrequency}
          </Badge>

          {/* Certification requirement */}
          {certLabel && (
            <Badge variant="warning" className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Requires: {certLabel}
            </Badge>
          )}

          {/* Payment type */}
          <Badge variant="outline">
            {client.isPrivatePay ? `Private Pay $${client.sessionRate}` : client.insuranceProvider}
          </Badge>
        </div>
      </div>
    </Card>
  )
}
