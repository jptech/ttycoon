import type { InsurancePanel, InsurerId, PendingClaim } from '@/core/types'
import { InsuranceManager } from '@/core/insurance'
import styles from './InsurancePanelView.module.css'

export interface InsurancePanelViewProps {
  panels: Record<InsurerId, InsurancePanel>
  activePanels: InsurerId[]
  pendingApplications: InsurerId[]
  pendingClaims: PendingClaim[]
  currentBalance: number
  reputation: number
  insuranceMultiplier: number
  currentDay: number
  onApply?: (panelId: InsurerId) => void
  onDrop?: (panelId: InsurerId) => void
}

export function InsurancePanelView({
  panels,
  activePanels,
  pendingApplications,
  pendingClaims,
  currentBalance,
  reputation,
  insuranceMultiplier,
  currentDay,
  onApply,
  onDrop,
}: InsurancePanelViewProps) {
  const claimStats = InsuranceManager.getClaimStats(pendingClaims)
  const panelSummary = InsuranceManager.getActivePanelsSummary(
    activePanels,
    panels,
    insuranceMultiplier
  )

  const panelList = Object.values(panels).sort(
    (a, b) => a.minReputation - b.minReputation
  )

  const getStatusBadge = (panelId: InsurerId) => {
    const status = InsuranceManager.getPanelStatus(
      panelId,
      activePanels,
      pendingApplications
    )

    switch (status) {
      case 'active':
        return <span className={styles.statusActive}>Active</span>
      case 'pending':
        return <span className={styles.statusPending}>Pending</span>
      default:
        return null
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Insurance Panels</h2>
        {insuranceMultiplier > 1 && (
          <span className={styles.multiplierBadge}>
            {insuranceMultiplier.toFixed(1)}x multiplier
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className={styles.summarySection}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{panelSummary.panelCount}</span>
            <span className={styles.summaryLabel}>Active Panels</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>${panelSummary.averageReimbursement}</span>
            <span className={styles.summaryLabel}>Avg Reimbursement</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{claimStats.totalPending}</span>
            <span className={styles.summaryLabel}>Pending Claims</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              ${claimStats.totalPendingAmount.toLocaleString()}
            </span>
            <span className={styles.summaryLabel}>Expected Income</span>
          </div>
        </div>
      </div>

      {/* Panel List */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Available Panels</h3>
        <div className={styles.panelList}>
          {panelList.map((panel) => {
            const status = InsuranceManager.getPanelStatus(
              panel.id,
              activePanels,
              pendingApplications
            )
            const check = InsuranceManager.canApplyToPanel(
              panel,
              reputation,
              currentBalance,
              activePanels,
              pendingApplications
            )
            const acceptanceRate = InsuranceManager.calculateAcceptanceRate(panel, reputation)
            const effectiveReimbursement = InsuranceManager.calculateInsurancePayment(
              panel,
              insuranceMultiplier
            )

            return (
              <div
                key={panel.id}
                className={`${styles.panelCard} ${status === 'active' ? styles.panelActive : ''}`}
              >
                <div className={styles.panelHeader}>
                  <span className={styles.panelName}>{panel.name}</span>
                  {getStatusBadge(panel.id)}
                </div>

                <div className={styles.panelDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Reimbursement</span>
                    <span className={styles.detailValue}>
                      ${effectiveReimbursement}
                      {insuranceMultiplier > 1 && (
                        <span className={styles.baseAmount}> (base ${panel.reimbursement})</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Payment Delay</span>
                    <span className={styles.detailValue}>{panel.delayDays} days</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Denial Rate</span>
                    <span className={styles.detailValue}>
                      {Math.round(panel.denialRate * 100)}%
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Min Reputation</span>
                    <span
                      className={`${styles.detailValue} ${
                        reputation < panel.minReputation ? styles.notMet : ''
                      }`}
                    >
                      {panel.minReputation}
                    </span>
                  </div>
                </div>

                {status === 'available' && (
                  <div className={styles.applicationSection}>
                    <div className={styles.applicationInfo}>
                      <span>Application Fee: ${panel.applicationFee}</span>
                      <span>
                        Acceptance: ~{Math.round(acceptanceRate * 100)}%
                      </span>
                    </div>
                    <button
                      className={`${styles.applyButton} ${!check.canApply ? styles.disabled : ''}`}
                      onClick={() => onApply?.(panel.id)}
                      disabled={!check.canApply}
                    >
                      {check.canApply ? 'Apply' : check.reason}
                    </button>
                  </div>
                )}

                {status === 'active' && (
                  <div className={styles.activeSection}>
                    {claimStats.claimsByInsurer[panel.id]?.count > 0 && (
                      <div className={styles.claimInfo}>
                        <span>
                          {claimStats.claimsByInsurer[panel.id].count} pending claims
                        </span>
                        <span>
                          ${claimStats.claimsByInsurer[panel.id].amount.toLocaleString()} expected
                        </span>
                      </div>
                    )}
                    <button
                      className={styles.dropButton}
                      onClick={() => onDrop?.(panel.id)}
                    >
                      Drop Panel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending Claims Detail */}
      {pendingClaims.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Pending Claims ({pendingClaims.length})
          </h3>
          <div className={styles.claimsList}>
            {pendingClaims
              .filter((c) => c.status === 'pending')
              .sort((a, b) => a.scheduledPaymentDay - b.scheduledPaymentDay)
              .slice(0, 5)
              .map((claim) => (
                <div key={claim.id} className={styles.claimRow}>
                  <span className={styles.claimInsurer}>
                    {panels[claim.insurerId]?.name || claim.insurerId}
                  </span>
                  <span className={styles.claimAmount}>
                    ${claim.amount}
                  </span>
                  <span className={styles.claimDue}>
                    Day {claim.scheduledPaymentDay}
                    {claim.scheduledPaymentDay <= currentDay && (
                      <span className={styles.dueNow}> (due)</span>
                    )}
                  </span>
                </div>
              ))}
            {pendingClaims.length > 5 && (
              <div className={styles.moreClaimsNote}>
                +{pendingClaims.length - 5} more claims
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
