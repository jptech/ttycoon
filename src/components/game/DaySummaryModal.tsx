import type { DaySummary } from '@/core/summary'
import { DaySummaryManager } from '@/core/summary'
import styles from './DaySummaryModal.module.css'

export interface DaySummaryModalProps {
  summary: DaySummary
  onContinue: () => void
}

export function DaySummaryModal({ summary, onContinue }: DaySummaryModalProps) {
  const rating = DaySummaryManager.getDayRating(summary)
  const { formatCurrency } = DaySummaryManager

  const getRatingClass = () => {
    switch (rating) {
      case 'excellent':
        return styles.ratingExcellent
      case 'good':
        return styles.ratingGood
      case 'average':
        return styles.ratingAverage
      case 'poor':
        return styles.ratingPoor
      default:
        return ''
    }
  }

  const getRatingLabel = () => {
    switch (rating) {
      case 'excellent':
        return 'Excellent Day!'
      case 'good':
        return 'Good Day'
      case 'average':
        return 'Average Day'
      case 'poor':
        return 'Challenging Day'
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Day {summary.day} Summary</h2>
          <span className={`${styles.ratingBadge} ${getRatingClass()}`}>
            {getRatingLabel()}
          </span>
        </div>

        <div className={styles.sections}>
          {/* Financial Summary */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Finances</h3>
            <div className={styles.grid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Income</span>
                <span className={`${styles.statValue} ${styles.positive}`}>
                  {formatCurrency(summary.financials.totalIncome)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Expenses</span>
                <span className={`${styles.statValue} ${styles.negative}`}>
                  {formatCurrency(summary.financials.totalExpenses)}
                </span>
              </div>
              <div className={`${styles.stat} ${styles.highlight}`}>
                <span className={styles.statLabel}>Net Income</span>
                <span className={`${styles.statValue} ${
                  summary.financials.netIncome >= 0 ? styles.positive : styles.negative
                }`}>
                  {formatCurrency(summary.financials.netIncome)}
                </span>
              </div>
            </div>
            {summary.financials.sessionsRevenue > 0 && (
              <div className={styles.breakdown}>
                <span>Sessions: {formatCurrency(summary.financials.sessionsRevenue)}</span>
                {summary.financials.insuranceRevenue > 0 && (
                  <span>Insurance: {formatCurrency(summary.financials.insuranceRevenue)}</span>
                )}
              </div>
            )}
          </div>

          {/* Sessions Summary */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Sessions</h3>
            <div className={styles.grid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Completed</span>
                <span className={styles.statValue}>{summary.sessions.completed}</span>
              </div>
              {summary.sessions.cancelled > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Cancelled</span>
                  <span className={`${styles.statValue} ${styles.negative}`}>
                    {summary.sessions.cancelled}
                  </span>
                </div>
              )}
              {summary.sessions.completed > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg Quality</span>
                  <span className={styles.statValue}>
                    {Math.round(summary.sessions.averageQuality * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Clients Summary */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Clients</h3>
            <div className={styles.grid}>
              {summary.clients.newArrivals > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>New Arrivals</span>
                  <span className={`${styles.statValue} ${styles.positive}`}>
                    +{summary.clients.newArrivals}
                  </span>
                </div>
              )}
              {summary.clients.treatmentCompleted > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Completed Treatment</span>
                  <span className={styles.statValue}>{summary.clients.treatmentCompleted}</span>
                </div>
              )}
              {summary.clients.droppedClients > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Dropped</span>
                  <span className={`${styles.statValue} ${styles.negative}`}>
                    {summary.clients.droppedClients}
                  </span>
                </div>
              )}
              <div className={styles.stat}>
                <span className={styles.statLabel}>Waiting List</span>
                <span className={styles.statValue}>{summary.clients.waitingListCount}</span>
              </div>
            </div>
          </div>

          {/* Team Summary */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Team</h3>
            <div className={styles.grid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Avg Energy</span>
                <span className={`${styles.statValue} ${
                  summary.therapists.averageEnergy >= 70 ? styles.positive :
                  summary.therapists.averageEnergy >= 40 ? '' : styles.negative
                }`}>
                  {summary.therapists.averageEnergy}%
                </span>
              </div>
              {summary.therapists.totalXpGained > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>XP Gained</span>
                  <span className={`${styles.statValue} ${styles.positive}`}>
                    +{summary.therapists.totalXpGained}
                  </span>
                </div>
              )}
              {summary.therapists.trainingsInProgress > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>In Training</span>
                  <span className={styles.statValue}>
                    {summary.therapists.trainingsInProgress}
                  </span>
                </div>
              )}
              {summary.therapists.burnedOutCount > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Burned Out</span>
                  <span className={`${styles.statValue} ${styles.negative}`}>
                    {summary.therapists.burnedOutCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Claims Summary (only if there are claims) */}
          {(summary.claims.submitted > 0 || summary.claims.pendingAmount > 0) && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Insurance Claims</h3>
              <div className={styles.grid}>
                {summary.claims.submitted > 0 && (
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Submitted</span>
                    <span className={styles.statValue}>{summary.claims.submitted}</span>
                  </div>
                )}
                {summary.claims.paid > 0 && (
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Paid</span>
                    <span className={`${styles.statValue} ${styles.positive}`}>
                      {summary.claims.paid}
                    </span>
                  </div>
                )}
                {summary.claims.denied > 0 && (
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Denied</span>
                    <span className={`${styles.statValue} ${styles.negative}`}>
                      {summary.claims.denied}
                    </span>
                  </div>
                )}
                {summary.claims.pendingAmount > 0 && (
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Pending</span>
                    <span className={styles.statValue}>
                      {formatCurrency(summary.claims.pendingAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button className={styles.continueButton} onClick={onContinue}>
          Continue to Day {summary.day + 1}
        </button>
      </div>
    </div>
  )
}
