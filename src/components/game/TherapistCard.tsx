import type { Therapist } from '@/core/types'
import { TherapistManager } from '@/core/therapists'
import styles from './TherapistCard.module.css'

export interface TherapistCardProps {
  therapist: Therapist
  onStartTraining?: (therapistId: string) => void
  onTakeBreak?: (therapistId: string) => void
  onViewDetails?: (therapistId: string) => void
  compact?: boolean
}

export function TherapistCard({
  therapist,
  onStartTraining,
  onTakeBreak,
  onViewDetails,
  compact = false,
}: TherapistCardProps) {
  const energyDisplay = TherapistManager.getEnergyDisplay(therapist)
  const burnoutRisk = TherapistManager.isBurnoutRisk(therapist)

  const getStatusClass = () => {
    switch (therapist.status) {
      case 'available':
        return styles.statusAvailable
      case 'in_session':
        return styles.statusSession
      case 'on_break':
        return styles.statusBreak
      case 'in_training':
        return styles.statusTraining
      case 'burned_out':
        return styles.statusBurnedOut
      default:
        return ''
    }
  }

  const getEnergyClass = () => {
    switch (energyDisplay.status) {
      case 'good':
        return styles.energyGood
      case 'warning':
        return styles.energyWarning
      case 'critical':
        return styles.energyCritical
      default:
        return ''
    }
  }

  const formatStatus = (status: Therapist['status']) => {
    switch (status) {
      case 'available':
        return 'Available'
      case 'in_session':
        return 'In Session'
      case 'on_break':
        return 'On Break'
      case 'in_training':
        return 'Training'
      case 'burned_out':
        return 'Burned Out'
    }
  }

  if (compact) {
    return (
      <div
        className={`${styles.cardCompact} ${getStatusClass()}`}
        onClick={() => onViewDetails?.(therapist.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onViewDetails?.(therapist.id)}
      >
        <span className={styles.therapistName}>{therapist.displayName}</span>
        <span className={styles.level}>Lv.{therapist.level}</span>
        <div className={`${styles.energyBar} ${getEnergyClass()}`}>
          <div
            className={styles.energyFill}
            style={{ width: `${energyDisplay.percentage}%` }}
          />
        </div>
        {therapist.isPlayer && <span className={styles.playerBadge}>You</span>}
        {burnoutRisk && <span className={styles.riskBadge}>!</span>}
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${getStatusClass()}`}>
      <div className={styles.header}>
        <div className={styles.nameRow}>
          <h3 className={styles.therapistName}>{therapist.displayName}</h3>
          {therapist.isPlayer && <span className={styles.playerBadge}>You</span>}
        </div>
        <span className={`${styles.statusBadge} ${getStatusClass()}`}>
          {formatStatus(therapist.status)}
        </span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Level</span>
          <span className={styles.statValue}>{therapist.level}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Skill</span>
          <span className={styles.statValue}>{therapist.baseSkill}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>XP</span>
          <span className={styles.statValue}>
            {therapist.xp}/{TherapistManager.getXpForLevel(therapist.level + 1)}
          </span>
        </div>
      </div>

      <div className={styles.energySection}>
        <div className={styles.energyLabel}>
          <span>Energy</span>
          <span className={getEnergyClass()}>{energyDisplay.label}</span>
        </div>
        <div className={`${styles.energyBarLarge} ${getEnergyClass()}`}>
          <div
            className={styles.energyFill}
            style={{ width: `${energyDisplay.percentage}%` }}
          />
        </div>
        {burnoutRisk && (
          <span className={styles.burnoutWarning}>Burnout risk - consider taking a break</span>
        )}
      </div>

      {therapist.status === 'burned_out' && (
        <div className={styles.burnoutProgress}>
          <span>Recovery Progress</span>
          <div className={styles.recoveryBar}>
            <div
              className={styles.recoveryFill}
              style={{ width: `${therapist.burnoutRecoveryProgress}%` }}
            />
          </div>
        </div>
      )}

      {therapist.certifications.length > 0 && (
        <div className={styles.certifications}>
          <span className={styles.sectionLabel}>Certifications</span>
          <div className={styles.certList}>
            {therapist.certifications.map((cert) => (
              <span key={cert} className={styles.certBadge}>
                {cert.replace('_', ' ').replace('certified', '')}
              </span>
            ))}
          </div>
        </div>
      )}

      {therapist.specializations.length > 0 && (
        <div className={styles.specializations}>
          <span className={styles.sectionLabel}>Specializations</span>
          <div className={styles.specList}>
            {therapist.specializations.slice(0, 3).map((spec) => (
              <span key={spec} className={styles.specBadge}>
                {spec.replace('_', ' ')}
              </span>
            ))}
            {therapist.specializations.length > 3 && (
              <span className={styles.moreCount}>
                +{therapist.specializations.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.traits}>
        <span className={styles.sectionLabel}>Traits</span>
        <div className={styles.traitList}>
          <span>Warmth: {therapist.traits.warmth}/10</span>
          <span>Analytical: {therapist.traits.analytical}/10</span>
          <span>Creativity: {therapist.traits.creativity}/10</span>
        </div>
      </div>

      {!therapist.isPlayer && (
        <div className={styles.salary}>
          <span className={styles.salaryLabel}>Hourly Rate:</span>
          <span className={styles.salaryValue}>${therapist.hourlySalary}</span>
        </div>
      )}

      <div className={styles.actions}>
        {therapist.status === 'available' && onTakeBreak && (
          <button
            className={styles.actionButton}
            onClick={() => onTakeBreak(therapist.id)}
          >
            Take Break
          </button>
        )}
        {therapist.status === 'available' && onStartTraining && (
          <button
            className={`${styles.actionButton} ${styles.primaryButton}`}
            onClick={() => onStartTraining(therapist.id)}
          >
            Start Training
          </button>
        )}
        {onViewDetails && (
          <button
            className={styles.viewButton}
            onClick={() => onViewDetails(therapist.id)}
          >
            View Details
          </button>
        )}
      </div>
    </div>
  )
}
