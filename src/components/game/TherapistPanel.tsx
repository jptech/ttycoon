import { useState } from 'react'
import type { Therapist, ActiveTraining } from '@/core/types'
import { TherapistManager } from '@/core/therapists'
import { TRAINING_PROGRAMS } from '@/data/trainingPrograms'
import { TherapistCard } from './TherapistCard'
import styles from './TherapistPanel.module.css'

export interface TherapistPanelProps {
  therapists: Therapist[]
  activeTrainings: ActiveTraining[]
  currentBalance: number
  onHire?: (therapist: Therapist, cost: number) => void
  onStartTraining?: (therapistId: string) => void
  onTakeBreak?: (therapistId: string) => void
  onViewDetails?: (therapistId: string) => void
  practiceLevel?: number
}

type ViewMode = 'roster' | 'hiring'

export function TherapistPanel({
  therapists,
  activeTrainings,
  currentBalance,
  onHire,
  onStartTraining,
  onTakeBreak,
  onViewDetails,
  practiceLevel = 1,
}: TherapistPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('roster')
  const [hiringCandidates, setHiringCandidates] = useState<ReturnType<typeof TherapistManager.generateTherapist>[]>([])
  const [showCompact, setShowCompact] = useState(false)

  const stats = TherapistManager.getTherapistStats(therapists)
  const monthlyCost = TherapistManager.getMonthlySalaryCost(therapists)

  const generateCandidates = () => {
    const candidates = []
    for (let i = 0; i < 3; i++) {
      candidates.push(TherapistManager.generateTherapist(1, practiceLevel, Date.now() + i))
    }
    setHiringCandidates(candidates)
  }

  const handleHire = (candidate: ReturnType<typeof TherapistManager.generateTherapist>) => {
    if (onHire && currentBalance >= candidate.hiringCost) {
      onHire(candidate.therapist, candidate.hiringCost)
      setHiringCandidates((prev) => prev.filter((c) => c.therapist.id !== candidate.therapist.id))
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Team Management</h2>
        <button
          className={styles.compactToggle}
          onClick={() => setShowCompact(!showCompact)}
        >
          {showCompact ? 'Full View' : 'Compact'}
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.available}</span>
          <span className={styles.statLabel}>Available</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.inSession}</span>
          <span className={styles.statLabel}>In Session</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.avgEnergy}%</span>
          <span className={styles.statLabel}>Avg Energy</span>
        </div>
        {stats.burnedOut > 0 && (
          <div className={`${styles.stat} ${styles.statWarning}`}>
            <span className={styles.statValue}>{stats.burnedOut}</span>
            <span className={styles.statLabel}>Burned Out</span>
          </div>
        )}
      </div>

      <div className={styles.monthlyCost}>
        <span>Monthly Salary Cost:</span>
        <span className={styles.costValue}>${monthlyCost.toLocaleString()}</span>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${viewMode === 'roster' ? styles.tabActive : ''}`}
          onClick={() => setViewMode('roster')}
        >
          Current Roster ({therapists.length})
        </button>
        <button
          className={`${styles.tab} ${viewMode === 'hiring' ? styles.tabActive : ''}`}
          onClick={() => {
            setViewMode('hiring')
            if (hiringCandidates.length === 0) generateCandidates()
          }}
        >
          Hire New
        </button>
      </div>

      {viewMode === 'roster' && (
        <div className={styles.therapistList}>
          {therapists.length === 0 ? (
            <div className={styles.emptyState}>No therapists on roster</div>
          ) : (
            therapists.map((therapist) => {
              const activeTraining = activeTrainings.find(t => t.therapistId === therapist.id)
              const trainingProgram = activeTraining ? TRAINING_PROGRAMS[activeTraining.programId] : undefined
              return (
                <TherapistCard
                  key={therapist.id}
                  therapist={therapist}
                  activeTraining={activeTraining}
                  trainingProgram={trainingProgram}
                  onStartTraining={onStartTraining}
                  onTakeBreak={onTakeBreak}
                  onViewDetails={onViewDetails}
                  compact={showCompact}
                />
              )
            })
          )}
        </div>
      )}

      {viewMode === 'hiring' && (
        <div className={styles.hiringSection}>
          <div className={styles.hiringHeader}>
            <p className={styles.hiringInfo}>
              Available candidates (refresh to see new options):
            </p>
            <button className={styles.refreshButton} onClick={generateCandidates}>
              Refresh Candidates
            </button>
          </div>

          <div className={styles.candidateList}>
            {hiringCandidates.map((candidate) => (
              <div key={candidate.therapist.id} className={styles.candidateCard}>
                <div className={styles.candidateInfo}>
                  <h3 className={styles.candidateName}>{candidate.therapist.displayName}</h3>
                  <div className={styles.candidateStats}>
                    <span>Level {candidate.therapist.level}</span>
                    <span>Skill: {candidate.therapist.baseSkill}</span>
                  </div>
                  {candidate.therapist.certifications.length > 0 && (
                    <div className={styles.candidateCerts}>
                      {candidate.therapist.certifications.map((cert) => (
                        <span key={cert} className={styles.certBadge}>
                          {cert.replace('_', ' ').replace('certified', '')}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={styles.candidateSpecs}>
                    {candidate.therapist.specializations.slice(0, 2).map((spec) => (
                      <span key={spec} className={styles.specBadge}>
                        {spec.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.candidateCosts}>
                  <div className={styles.costRow}>
                    <span>Hiring Cost:</span>
                    <span className={styles.costAmount}>${candidate.hiringCost.toLocaleString()}</span>
                  </div>
                  <div className={styles.costRow}>
                    <span>Monthly Salary:</span>
                    <span className={styles.costAmount}>${candidate.monthlySalary.toLocaleString()}</span>
                  </div>
                  <div className={styles.costRow}>
                    <span>Hourly Rate:</span>
                    <span>${candidate.therapist.hourlySalary}/hr</span>
                  </div>
                </div>

                <button
                  className={`${styles.hireButton} ${currentBalance < candidate.hiringCost ? styles.disabled : ''}`}
                  onClick={() => handleHire(candidate)}
                  disabled={currentBalance < candidate.hiringCost}
                >
                  {currentBalance < candidate.hiringCost
                    ? `Need $${(candidate.hiringCost - currentBalance).toLocaleString()} more`
                    : 'Hire'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
