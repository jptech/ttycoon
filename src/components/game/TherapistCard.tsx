import type { Therapist, ActiveTraining, TrainingProgram, Session, Schedule } from '@/core/types'
import { TherapistManager, CREDENTIAL_CONFIG, MODALITY_CONFIG, type EnergyForecast } from '@/core/therapists'
import { TrainingProcessor } from '@/core/training'
import { Clock, AlertTriangle } from 'lucide-react'
import styles from './TherapistCard.module.css'

export interface TherapistCardProps {
  therapist: Therapist
  activeTraining?: ActiveTraining
  trainingProgram?: TrainingProgram
  sessions?: Session[]
  schedule?: Schedule
  currentDay?: number
  onStartTraining?: (therapistId: string) => void
  onTakeBreak?: (therapistId: string) => void
  onViewDetails?: (therapistId: string) => void
  onEditSchedule?: (therapistId: string) => void
  compact?: boolean
}

export function TherapistCard({
  therapist,
  activeTraining,
  trainingProgram,
  sessions,
  schedule,
  currentDay,
  onStartTraining,
  onTakeBreak,
  onViewDetails,
  onEditSchedule,
  compact = false,
}: TherapistCardProps) {
  const energyDisplay = TherapistManager.getEnergyDisplay(therapist)
  const burnoutRisk = TherapistManager.isBurnoutRisk(therapist)

  // Calculate energy forecast if we have the required data
  const energyForecast: EnergyForecast | null =
    sessions && schedule && currentDay !== undefined
      ? TherapistManager.forecastEnergy(therapist, sessions, schedule, currentDay)
      : null

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
    const trainingProgress = activeTraining ? TrainingProcessor.getTrainingProgress(activeTraining) : 0
    const daysRemaining = activeTraining ? TrainingProcessor.getDaysRemaining(activeTraining) : 0

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
        {therapist.status === 'in_training' && activeTraining ? (
          <div className={styles.trainingBadgeCompact} title={`Training: ${trainingProgress}% (${daysRemaining}d remaining)`}>
            <span className={styles.trainingIcon}>📚</span>
            <span className={styles.trainingPercent}>{trainingProgress}%</span>
          </div>
        ) : (
          <div className={`${styles.energyBar} ${getEnergyClass()}`}>
            <div
              className={styles.energyFill}
              style={{ width: `${energyDisplay.percentage}%` }}
            />
          </div>
        )}
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

      {therapist.credential && therapist.primaryModality && (
        <div className={styles.professionalInfo}>
          <span className={styles.credentialBadge} title={CREDENTIAL_CONFIG[therapist.credential]?.name ?? 'Unknown'}>
            {therapist.credential}
          </span>
          <span className={styles.modalityBadge} title={MODALITY_CONFIG[therapist.primaryModality]?.description ?? 'Unknown'}>
            {MODALITY_CONFIG[therapist.primaryModality]?.name ?? therapist.primaryModality}
          </span>
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Level</span>
          <span className={styles.levelBadge}>{therapist.level}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Skill</span>
          <span className={styles.statValue}>{therapist.baseSkill}</span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className={styles.xpSection}>
        <div className={styles.xpHeader}>
          <span className={styles.xpLabel}>XP Progress</span>
          <span className={styles.xpValue}>
            {therapist.xp} / {TherapistManager.getXpForLevel(therapist.level + 1)}
          </span>
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            style={{
              width: `${(therapist.xp / TherapistManager.getXpForLevel(therapist.level + 1)) * 100}%`,
            }}
          />
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

      {/* Energy Forecast */}
      {energyForecast && energyForecast.scheduledSessionCount > 0 && (
        <div className={`${styles.forecastSection} ${energyForecast.willBurnOut ? styles.forecastWarning : ''}`}>
          <div className={styles.forecastHeader}>
            <span className={styles.forecastLabel}>Today's Forecast</span>
            {energyForecast.willBurnOut && (
              <AlertTriangle className={styles.warningIcon} />
            )}
          </div>
          <div className={styles.forecastContent}>
            <span>{energyForecast.scheduledSessionCount} session{energyForecast.scheduledSessionCount !== 1 ? 's' : ''}</span>
            <span className={styles.forecastEnergy}>
              ~{energyForecast.predictedEndEnergy} energy EOD
            </span>
          </div>
          {energyForecast.willBurnOut && (
            <span className={styles.forecastBurnout}>
              Burnout risk at {energyForecast.burnoutHour}:00
            </span>
          )}
        </div>
      )}

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

      {therapist.status === 'in_training' && activeTraining && (
        <div className={styles.trainingProgress}>
          <div className={styles.trainingHeader}>
            <span className={styles.trainingLabel}>Training Progress</span>
            {trainingProgram && (
              <span className={styles.trainingName}>{trainingProgram.name}</span>
            )}
          </div>
          <div className={styles.trainingBar}>
            <div
              className={styles.trainingFill}
              style={{ width: `${TrainingProcessor.getTrainingProgress(activeTraining)}%` }}
            />
          </div>
          <div className={styles.trainingStats}>
            <span>{TrainingProcessor.getTrainingProgress(activeTraining)}% complete</span>
            <span>{TrainingProcessor.getDaysRemaining(activeTraining)} day{TrainingProcessor.getDaysRemaining(activeTraining) !== 1 ? 's' : ''} remaining</span>
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
        {onEditSchedule && (
          <button
            className={styles.actionButton}
            onClick={() => onEditSchedule(therapist.id)}
            title="Edit work hours"
          >
            <Clock className={styles.buttonIcon} />
            Schedule
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
