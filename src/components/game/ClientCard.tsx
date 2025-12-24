import type { Client, Therapist } from '@/core/types'
import { ClientManager } from '@/core/clients'
import { Video, Building } from 'lucide-react'
import styles from './ClientCard.module.css'

const TIME_PREF_LABELS: Record<string, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
  any: '',
}

export interface ClientCardProps {
  client: Client
  therapists?: Therapist[]
  onAssign?: (clientId: string, therapistId: string) => void
  onViewDetails?: (clientId: string) => void
  compact?: boolean
}

export function ClientCard({
  client,
  therapists = [],
  onAssign,
  onViewDetails,
  compact = false,
}: ClientCardProps) {
  const dropoutRisk = ClientManager.checkDropoutRisk(client)

  const handleAssign = (therapistId: string) => {
    if (onAssign) {
      onAssign(client.id, therapistId)
    }
  }

  const getSeverityClass = () => {
    if (client.severity >= 8) return styles.severityHigh
    if (client.severity >= 5) return styles.severityMedium
    return styles.severityLow
  }

  const getStatusClass = () => {
    switch (client.status) {
      case 'waiting':
        return styles.statusWaiting
      case 'in_treatment':
        return styles.statusTreatment
      case 'completed':
        return styles.statusCompleted
      case 'dropped':
        return styles.statusDropped
      default:
        return ''
    }
  }

  const getRiskClass = () => {
    if (!dropoutRisk.atRisk) return ''
    switch (dropoutRisk.riskLevel) {
      case 'high':
        return styles.riskHigh
      case 'medium':
        return styles.riskMedium
      case 'low':
        return styles.riskLow
      default:
        return ''
    }
  }

  if (compact) {
    const timePrefLabel = TIME_PREF_LABELS[client.preferredTime]
    const needsCert = client.requiredCertification || client.isMinor || client.isCouple

    return (
      <div
        className={`${styles.cardCompact} ${getStatusClass()}`}
        onClick={() => onViewDetails?.(client.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onViewDetails?.(client.id)}
      >
        <span className={styles.clientName}>{client.displayName}</span>

        {/* Preference indicators */}
        <div className={styles.preferenceIndicators}>
          {/* Virtual/In-person preference */}
          {client.prefersVirtual ? (
            <span
              className={`${styles.prefIcon} ${styles.prefIconVirtual}`}
              title="Prefers virtual sessions"
            >
              <Video size={12} />
            </span>
          ) : (
            <span
              className={`${styles.prefIcon} ${styles.prefIconOffice}`}
              title="Prefers in-office sessions"
            >
              <Building size={12} />
            </span>
          )}

          {/* Time preference */}
          {timePrefLabel && (
            <span className={styles.timePref} title={`Prefers ${client.preferredTime}`}>
              {timePrefLabel}
            </span>
          )}

          {/* Certification requirement */}
          {needsCert && (
            <span
              className={styles.certRequired}
              title={
                client.isMinor
                  ? 'Requires children certification'
                  : client.isCouple
                    ? 'Requires couples certification'
                    : `Requires ${client.requiredCertification}`
              }
            >
              !
            </span>
          )}
        </div>

        <span className={`${styles.severity} ${getSeverityClass()}`}>{client.severity}/10</span>
        {client.status === 'waiting' && (
          <span className={styles.waitDays}>{client.daysWaiting}d</span>
        )}
        {dropoutRisk.atRisk && <span className={`${styles.riskBadge} ${getRiskClass()}`}>!</span>}
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${getStatusClass()}`}>
      <div className={styles.header}>
        <h3 className={styles.clientName}>{client.displayName}</h3>
        <span className={`${styles.statusBadge} ${getStatusClass()}`}>{client.status}</span>
      </div>

      <div className={styles.condition}>
        <span className={styles.conditionType}>{client.conditionType}</span>
        <span className={`${styles.severity} ${getSeverityClass()}`}>
          Severity: {client.severity}/10
        </span>
      </div>

      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.label}>Payment:</span>
          <span>{client.isPrivatePay ? 'Private Pay' : client.insuranceProvider}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.label}>Rate:</span>
          <span>${client.sessionRate}/session</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.label}>Frequency:</span>
          <span>{client.preferredFrequency}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.label}>Time:</span>
          <span>{client.preferredTime}</span>
        </div>
        {client.prefersVirtual && (
          <div className={styles.detailRow}>
            <span className={styles.badge}>Prefers Virtual</span>
          </div>
        )}
        {client.isMinor && (
          <div className={styles.detailRow}>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>Minor - Requires Children Cert</span>
          </div>
        )}
        {client.isCouple && (
          <div className={styles.detailRow}>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>Couple - Requires Couples Cert</span>
          </div>
        )}
        {client.requiredCertification && !client.isMinor && !client.isCouple && (
          <div className={styles.detailRow}>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>
              Requires: {client.requiredCertification.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {client.status === 'in_treatment' && (
        <div className={styles.progress}>
          <div className={styles.progressLabel}>
            <span>Treatment Progress</span>
            <span>
              {client.sessionsCompleted}/{client.sessionsRequired} sessions
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${client.treatmentProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {client.status === 'waiting' && (
        <div className={styles.waitingInfo}>
          <span>Waiting: {client.daysWaiting} / {client.maxWaitDays} days</span>
          {dropoutRisk.atRisk && (
            <span className={`${styles.riskWarning} ${getRiskClass()}`}>
              {dropoutRisk.riskLevel.toUpperCase()} dropout risk
            </span>
          )}
        </div>
      )}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Satisfaction</span>
          <span className={styles.metricValue}>{client.satisfaction}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Engagement</span>
          <span className={styles.metricValue}>{client.engagement}%</span>
        </div>
      </div>

      {client.status === 'waiting' && therapists.length > 0 && onAssign && (
        <div className={styles.assignSection}>
          <span className={styles.assignLabel}>Assign to:</span>
          <div className={styles.therapistList}>
            {therapists.map((therapist) => {
              const match = ClientManager.calculateMatchScore(client, therapist)
              return (
                <button
                  key={therapist.id}
                  className={`${styles.assignButton} ${match.breakdown.certificationMatch === 0 ? styles.disabled : ''}`}
                  onClick={() => handleAssign(therapist.id)}
                  disabled={match.breakdown.certificationMatch === 0}
                  title={
                    match.breakdown.certificationMatch === 0
                      ? 'Missing required certification'
                      : `Match score: ${match.score}%`
                  }
                >
                  {therapist.displayName} ({match.score}%)
                </button>
              )
            })}
          </div>
        </div>
      )}

      {onViewDetails && (
        <button
          className={styles.viewButton}
          onClick={() => onViewDetails(client.id)}
        >
          View Details
        </button>
      )}
    </div>
  )
}
