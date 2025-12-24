import { useState } from 'react'
import type { Therapist, TrainingProgram } from '@/core/types'
import { TherapistManager } from '@/core/therapists'
import { getTrainingProgramsByTrack, formatTrainingDuration } from '@/data/trainingPrograms'
import styles from './TrainingModal.module.css'

export interface TrainingModalProps {
  therapist: Therapist
  currentBalance: number
  onStartTraining: (therapistId: string, programId: string) => void
  onClose: () => void
}

type TrackFilter = 'all' | 'clinical' | 'business'

export function TrainingModal({
  therapist,
  currentBalance,
  onStartTraining,
  onClose,
}: TrainingModalProps) {
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all')

  const clinicalPrograms = getTrainingProgramsByTrack('clinical')
  const businessPrograms = getTrainingProgramsByTrack('business')

  const getFilteredPrograms = (): TrainingProgram[] => {
    switch (trackFilter) {
      case 'clinical':
        return clinicalPrograms
      case 'business':
        return businessPrograms
      default:
        return [...clinicalPrograms, ...businessPrograms]
    }
  }

  const programs = getFilteredPrograms()

  const handleSelect = (program: TrainingProgram) => {
    const check = TherapistManager.canStartTraining(therapist, program)
    if (check.canStart && currentBalance >= program.cost) {
      onStartTraining(therapist.id, program.id)
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Training for {therapist.displayName}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.therapistInfo}>
          <span>Level {therapist.level}</span>
          <span>Skill: {therapist.baseSkill}</span>
          <span>Balance: ${currentBalance.toLocaleString()}</span>
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${trackFilter === 'all' ? styles.active : ''}`}
            onClick={() => setTrackFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterButton} ${trackFilter === 'clinical' ? styles.active : ''}`}
            onClick={() => setTrackFilter('clinical')}
          >
            Clinical
          </button>
          <button
            className={`${styles.filterButton} ${trackFilter === 'business' ? styles.active : ''}`}
            onClick={() => setTrackFilter('business')}
          >
            Business
          </button>
        </div>

        <div className={styles.programList}>
          {programs.map((program) => {
            const check = TherapistManager.canStartTraining(therapist, program)
            const canAfford = currentBalance >= program.cost
            const isAvailable = check.canStart && canAfford

            return (
              <div
                key={program.id}
                className={`${styles.programCard} ${!isAvailable ? styles.unavailable : ''}`}
              >
                <div className={styles.programHeader}>
                  <h3 className={styles.programName}>{program.name}</h3>
                  <span className={`${styles.trackBadge} ${styles[program.track]}`}>
                    {program.track}
                  </span>
                </div>

                <p className={styles.programDescription}>{program.description}</p>

                <div className={styles.programDetails}>
                  <div className={styles.detailRow}>
                    <span>Duration:</span>
                    <span>{formatTrainingDuration(program.durationHours)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Cost:</span>
                    <span className={!canAfford ? styles.cantAfford : ''}>
                      ${program.cost.toLocaleString()}
                    </span>
                  </div>
                </div>

                {program.prerequisites.minSkill && (
                  <div className={styles.prerequisite}>
                    <span>Requires Skill Level {program.prerequisites.minSkill}</span>
                    {therapist.baseSkill < program.prerequisites.minSkill && (
                      <span className={styles.notMet}>Not Met</span>
                    )}
                  </div>
                )}

                {program.prerequisites.certifications && program.prerequisites.certifications.length > 0 && (
                  <div className={styles.prerequisite}>
                    <span>
                      Requires: {program.prerequisites.certifications.map((c) => c.replace('_', ' ')).join(', ')}
                    </span>
                    {program.prerequisites.certifications.some((c) => !therapist.certifications.includes(c)) && (
                      <span className={styles.notMet}>Not Met</span>
                    )}
                  </div>
                )}

                <div className={styles.grants}>
                  <span className={styles.grantsLabel}>Grants:</span>
                  {program.grants.certification && (
                    <span className={styles.grantBadge}>
                      {program.grants.certification.replace('_', ' ')}
                    </span>
                  )}
                  {program.grants.skillBonus && (
                    <span className={styles.grantBadge}>+{program.grants.skillBonus} Skill</span>
                  )}
                  {program.grants.clinicBonus && (
                    <span className={styles.grantBadge}>
                      {program.grants.clinicBonus.type.replace('_', ' ')} +{program.grants.clinicBonus.value}
                    </span>
                  )}
                </div>

                {!check.canStart && (
                  <div className={styles.unavailableReason}>{check.reason}</div>
                )}

                <button
                  className={`${styles.selectButton} ${!isAvailable ? styles.disabled : ''}`}
                  onClick={() => handleSelect(program)}
                  disabled={!isAvailable}
                >
                  {!canAfford
                    ? `Need $${(program.cost - currentBalance).toLocaleString()} more`
                    : !check.canStart
                      ? 'Prerequisites Not Met'
                      : 'Start Training'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
