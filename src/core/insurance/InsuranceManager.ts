import type { InsurancePanel, InsurerId, PendingClaim, Session, DenialReason } from '@/core/types'
import { generateId } from '@/lib/utils'

/**
 * Configuration for the insurance system
 */
export const INSURANCE_CONFIG = {
  /** Base acceptance rate for panel applications (70-95% range) */
  BASE_ACCEPTANCE_RATE: 0.85,

  /** Acceptance rate boost per 50 reputation above minimum */
  REPUTATION_ACCEPTANCE_BONUS: 0.05,

  /** Maximum acceptance rate */
  MAX_ACCEPTANCE_RATE: 0.95,

  /** Minimum acceptance rate */
  MIN_ACCEPTANCE_RATE: 0.70,

  /** Default insurance multiplier */
  DEFAULT_MULTIPLIER: 1.0,

  /** Maximum insurance multiplier */
  MAX_MULTIPLIER: 1.5,

  /** Multiplier increase per business training completion */
  MULTIPLIER_INCREASE_PER_TRAINING: 0.1,

  /** Days allowed to appeal a denied claim */
  APPEAL_WINDOW_DAYS: 14,

  /** Additional delay days when appeal is processed */
  APPEAL_PROCESSING_DAYS: 7,

  /** Base success rate for appeals */
  APPEAL_SUCCESS_RATE: 0.5,
} as const

/**
 * Denial reason details with descriptions and appeal success rates
 */
export const DENIAL_REASONS: Record<DenialReason, {
  label: string
  description: string
  appealSuccessRate: number
}> = {
  insufficient_documentation: {
    label: 'Insufficient Documentation',
    description: 'Session notes did not meet documentation requirements',
    appealSuccessRate: 0.7, // High success - can provide more docs
  },
  medical_necessity: {
    label: 'Medical Necessity Not Established',
    description: 'Treatment was not deemed medically necessary',
    appealSuccessRate: 0.4, // Medium - subjective
  },
  session_limit_exceeded: {
    label: 'Session Limit Exceeded',
    description: 'Client has reached annual session limit',
    appealSuccessRate: 0.2, // Low - policy limit
  },
  coding_error: {
    label: 'Coding Error',
    description: 'Incorrect billing code submitted',
    appealSuccessRate: 0.85, // Very high - easy fix
  },
  prior_auth_required: {
    label: 'Prior Authorization Required',
    description: 'Session required pre-approval that was not obtained',
    appealSuccessRate: 0.3, // Low - missed requirement
  },
  out_of_network: {
    label: 'Out of Network',
    description: 'Provider not in network for this service',
    appealSuccessRate: 0.1, // Very low - contract issue
  },
}

/**
 * Weighted denial reasons (determines likelihood of each reason)
 */
const DENIAL_REASON_WEIGHTS: { reason: DenialReason; weight: number }[] = [
  { reason: 'insufficient_documentation', weight: 30 },
  { reason: 'medical_necessity', weight: 25 },
  { reason: 'coding_error', weight: 20 },
  { reason: 'session_limit_exceeded', weight: 10 },
  { reason: 'prior_auth_required', weight: 10 },
  { reason: 'out_of_network', weight: 5 },
]

/**
 * Insurance state tracking
 */
export interface InsuranceState {
  activePanels: InsurerId[]
  pendingApplications: InsurerId[]
  insuranceMultiplier: number
  pendingClaims: PendingClaim[]
}

/**
 * Panel application result
 */
export interface ApplicationResult {
  success: boolean
  accepted: boolean
  reason?: string
  panelId?: InsurerId
  applicationFee?: number
}

/**
 * Claim processing result
 */
export interface ClaimResult {
  claimId: string
  sessionId: string
  insurerId: InsurerId
  baseAmount: number
  multipliedAmount: number
  scheduledPaymentDay: number
}

/**
 * Claim resolution result
 */
export interface ClaimResolution {
  claimId: string
  paid: boolean
  amount: number
  denied: boolean
  denialReason?: DenialReason
  appealDeadlineDay?: number
}

/**
 * Appeal result
 */
export interface AppealResult {
  success: boolean
  claimId: string
  approved: boolean
  newPaymentDay?: number
  reason?: string
}

/**
 * Pure functions for managing the insurance system
 */
export const InsuranceManager = {
  /**
   * Check if a panel application can be submitted
   */
  canApplyToPanel(
    panel: InsurancePanel,
    reputation: number,
    currentBalance: number,
    activePanels: InsurerId[],
    pendingApplications: InsurerId[]
  ): { canApply: boolean; reason?: string } {
    // Already a member
    if (activePanels.includes(panel.id)) {
      return { canApply: false, reason: 'Already a member of this panel' }
    }

    // Application pending
    if (pendingApplications.includes(panel.id)) {
      return { canApply: false, reason: 'Application already pending' }
    }

    // Check reputation requirement
    if (reputation < panel.minReputation) {
      return {
        canApply: false,
        reason: `Requires ${panel.minReputation} reputation (current: ${Math.floor(reputation)})`,
      }
    }

    // Check application fee
    if (currentBalance < panel.applicationFee) {
      return {
        canApply: false,
        reason: `Need $${panel.applicationFee - currentBalance} more for application fee`,
      }
    }

    return { canApply: true }
  },

  /**
   * Calculate acceptance rate for a panel application
   */
  calculateAcceptanceRate(
    panel: InsurancePanel,
    reputation: number
  ): number {
    const reputationAboveMin = Math.max(0, reputation - panel.minReputation)
    const reputationBonus =
      Math.floor(reputationAboveMin / 50) * INSURANCE_CONFIG.REPUTATION_ACCEPTANCE_BONUS

    const rate = INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE + reputationBonus

    return Math.min(
      INSURANCE_CONFIG.MAX_ACCEPTANCE_RATE,
      Math.max(INSURANCE_CONFIG.MIN_ACCEPTANCE_RATE, rate)
    )
  },

  /**
   * Process a panel application
   */
  applyToPanel(
    panel: InsurancePanel,
    reputation: number,
    currentBalance: number,
    activePanels: InsurerId[],
    pendingApplications: InsurerId[],
    seed?: number
  ): ApplicationResult {
    const check = this.canApplyToPanel(
      panel,
      reputation,
      currentBalance,
      activePanels,
      pendingApplications
    )

    if (!check.canApply) {
      return { success: false, accepted: false, reason: check.reason }
    }

    // Roll for acceptance
    const acceptanceRate = this.calculateAcceptanceRate(panel, reputation)
    const roll = seed !== undefined ? seededRandom(seed)() : Math.random()
    const accepted = roll < acceptanceRate

    return {
      success: true,
      accepted,
      panelId: panel.id,
      applicationFee: panel.applicationFee,
      reason: accepted ? undefined : 'Application was not accepted',
    }
  },

  /**
   * Create a claim for an insurance session
   */
  createClaim(
    session: Session,
    panel: InsurancePanel,
    currentDay: number,
    insuranceMultiplier: number = INSURANCE_CONFIG.DEFAULT_MULTIPLIER
  ): ClaimResult {
    const baseAmount = panel.reimbursement
    const multipliedAmount = Math.round(baseAmount * insuranceMultiplier)
    const scheduledPaymentDay = currentDay + panel.delayDays

    return {
      claimId: generateId(),
      sessionId: session.id,
      insurerId: panel.id,
      baseAmount,
      multipliedAmount,
      scheduledPaymentDay,
    }
  },

  /**
   * Create a pending claim record
   */
  createPendingClaim(claimResult: ClaimResult): PendingClaim {
    return {
      id: claimResult.claimId,
      sessionId: claimResult.sessionId,
      insurerId: claimResult.insurerId,
      amount: claimResult.multipliedAmount,
      scheduledPaymentDay: claimResult.scheduledPaymentDay,
      status: 'pending',
    }
  },

  /**
   * Select a random denial reason using weighted probabilities
   */
  selectDenialReason(seed?: number): DenialReason {
    const totalWeight = DENIAL_REASON_WEIGHTS.reduce((sum, w) => sum + w.weight, 0)
    const roll = (seed !== undefined ? seededRandom(seed)() : Math.random()) * totalWeight

    let cumulative = 0
    for (const { reason, weight } of DENIAL_REASON_WEIGHTS) {
      cumulative += weight
      if (roll < cumulative) {
        return reason
      }
    }

    // Fallback (should never reach)
    return 'insufficient_documentation'
  },

  /**
   * Get denial reason details (label and description)
   */
  getDenialReasonDetails(reason: DenialReason): { label: string; description: string; appealSuccessRate: number } {
    return DENIAL_REASONS[reason]
  },

  /**
   * Process claims that are due for payment
   */
  processDueClaims(
    claims: PendingClaim[],
    currentDay: number,
    denialRates: Record<InsurerId, number>,
    seed?: number
  ): { paidClaims: ClaimResolution[]; deniedClaims: ClaimResolution[]; remainingClaims: PendingClaim[] } {
    const paidClaims: ClaimResolution[] = []
    const deniedClaims: ClaimResolution[] = []
    const remainingClaims: PendingClaim[] = []

    let seedOffset = 0
    for (const claim of claims) {
      if (claim.status !== 'pending') {
        continue
      }

      if (claim.scheduledPaymentDay <= currentDay) {
        // Roll for denial
        const denialRate = denialRates[claim.insurerId] ?? 0
        const roll = seed !== undefined ? seededRandom(seed + seedOffset)() : Math.random()
        seedOffset++

        if (roll < denialRate) {
          // Select a specific denial reason
          const denialReason = this.selectDenialReason(seed !== undefined ? seed + seedOffset + 1000 : undefined)
          const appealDeadlineDay = currentDay + INSURANCE_CONFIG.APPEAL_WINDOW_DAYS

          deniedClaims.push({
            claimId: claim.id,
            paid: false,
            amount: 0,
            denied: true,
            denialReason,
            appealDeadlineDay,
          })
        } else {
          paidClaims.push({
            claimId: claim.id,
            paid: true,
            amount: claim.amount,
            denied: false,
          })
        }
      } else {
        remainingClaims.push(claim)
      }
    }

    return { paidClaims, deniedClaims, remainingClaims }
  },

  /**
   * Get claims statistics
   */
  getClaimStats(claims: PendingClaim[]): {
    totalPending: number
    totalPendingAmount: number
    claimsByInsurer: Record<InsurerId, { count: number; amount: number }>
    oldestClaimDay: number | null
  } {
    const claimsByInsurer: Record<InsurerId, { count: number; amount: number }> = {
      aetna: { count: 0, amount: 0 },
      bluecross: { count: 0, amount: 0 },
      cigna: { count: 0, amount: 0 },
      united: { count: 0, amount: 0 },
      medicaid: { count: 0, amount: 0 },
    }

    let totalPending = 0
    let totalPendingAmount = 0
    let oldestClaimDay: number | null = null

    for (const claim of claims) {
      if (claim.status === 'pending') {
        totalPending++
        totalPendingAmount += claim.amount

        if (claimsByInsurer[claim.insurerId]) {
          claimsByInsurer[claim.insurerId].count++
          claimsByInsurer[claim.insurerId].amount += claim.amount
        }

        if (oldestClaimDay === null || claim.scheduledPaymentDay < oldestClaimDay) {
          oldestClaimDay = claim.scheduledPaymentDay
        }
      }
    }

    return {
      totalPending,
      totalPendingAmount,
      claimsByInsurer,
      oldestClaimDay,
    }
  },

  /**
   * Calculate expected income from pending claims
   */
  calculateExpectedIncome(
    claims: PendingClaim[],
    denialRates: Record<InsurerId, number>,
    daysAhead: number,
    currentDay: number
  ): number {
    let expectedIncome = 0

    for (const claim of claims) {
      if (
        claim.status === 'pending' &&
        claim.scheduledPaymentDay <= currentDay + daysAhead
      ) {
        const denialRate = denialRates[claim.insurerId] ?? 0
        const expectedValue = claim.amount * (1 - denialRate)
        expectedIncome += expectedValue
      }
    }

    return Math.round(expectedIncome)
  },

  /**
   * Get claims due within a time period
   */
  getClaimsDueWithin(
    claims: PendingClaim[],
    currentDay: number,
    daysAhead: number
  ): PendingClaim[] {
    return claims.filter(
      (claim) =>
        claim.status === 'pending' &&
        claim.scheduledPaymentDay <= currentDay + daysAhead &&
        claim.scheduledPaymentDay >= currentDay
    )
  },

  /**
   * Update insurance multiplier
   */
  updateMultiplier(
    currentMultiplier: number,
    increase: number
  ): number {
    const newMultiplier = currentMultiplier + increase
    return Math.min(INSURANCE_CONFIG.MAX_MULTIPLIER, newMultiplier)
  },

  /**
   * Calculate session payment for insurance client
   */
  calculateInsurancePayment(
    panel: InsurancePanel,
    insuranceMultiplier: number
  ): number {
    return Math.round(panel.reimbursement * insuranceMultiplier)
  },

  /**
   * Get panel membership status
   */
  getPanelStatus(
    panelId: InsurerId,
    activePanels: InsurerId[],
    pendingApplications: InsurerId[]
  ): 'active' | 'pending' | 'available' {
    if (activePanels.includes(panelId)) return 'active'
    if (pendingApplications.includes(panelId)) return 'pending'
    return 'available'
  },

  /**
   * Get summary of active panel benefits
   */
  getActivePanelsSummary(
    activePanels: InsurerId[],
    panels: Record<InsurerId, InsurancePanel>,
    insuranceMultiplier: number
  ): {
    panelCount: number
    averageReimbursement: number
    averageDelay: number
    totalPotentialClients: number
  } {
    if (activePanels.length === 0) {
      return {
        panelCount: 0,
        averageReimbursement: 0,
        averageDelay: 0,
        totalPotentialClients: 0,
      }
    }

    let totalReimbursement = 0
    let totalDelay = 0

    for (const panelId of activePanels) {
      const panel = panels[panelId]
      if (panel) {
        totalReimbursement += this.calculateInsurancePayment(panel, insuranceMultiplier)
        totalDelay += panel.delayDays
      }
    }

    return {
      panelCount: activePanels.length,
      averageReimbursement: Math.round(totalReimbursement / activePanels.length),
      averageDelay: Math.round(totalDelay / activePanels.length),
      // Each panel adds potential client pool
      totalPotentialClients: activePanels.length * 2,
    }
  },

  /**
   * Check if practice should consider more panels
   */
  shouldConsiderMorePanels(
    activePanels: InsurerId[],
    pendingClaims: PendingClaim[]
  ): { shouldConsider: boolean; reason?: string } {
    // If no panels, definitely should consider
    if (activePanels.length === 0) {
      return {
        shouldConsider: true,
        reason: 'No insurance panels - limits client pool',
      }
    }

    // If few pending claims, might benefit from more panels
    const claimStats = this.getClaimStats(pendingClaims)
    if (claimStats.totalPending < 5 && activePanels.length < 3) {
      return {
        shouldConsider: true,
        reason: 'Low claim volume - additional panels could help',
      }
    }

    return { shouldConsider: false }
  },

  /**
   * Check if a denied claim can be appealed
   */
  canAppealClaim(
    claim: PendingClaim,
    currentDay: number
  ): { canAppeal: boolean; reason?: string } {
    if (claim.status !== 'denied') {
      return { canAppeal: false, reason: 'Only denied claims can be appealed' }
    }

    if (!claim.denialReason) {
      return { canAppeal: false, reason: 'Claim has no denial reason' }
    }

    if (!claim.appealDeadlineDay) {
      return { canAppeal: false, reason: 'No appeal deadline set' }
    }

    if (currentDay > claim.appealDeadlineDay) {
      return { canAppeal: false, reason: 'Appeal deadline has passed' }
    }

    if (claim.appealSubmittedDay !== undefined) {
      return { canAppeal: false, reason: 'Appeal already submitted' }
    }

    return { canAppeal: true }
  },

  /**
   * Submit an appeal for a denied claim
   */
  submitAppeal(
    claim: PendingClaim,
    currentDay: number
  ): AppealResult {
    const check = this.canAppealClaim(claim, currentDay)

    if (!check.canAppeal) {
      return {
        success: false,
        claimId: claim.id,
        approved: false,
        reason: check.reason,
      }
    }

    return {
      success: true,
      claimId: claim.id,
      approved: false, // Not yet determined
      newPaymentDay: currentDay + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS,
    }
  },

  /**
   * Process appeals that are due for resolution
   */
  processAppeals(
    claims: PendingClaim[],
    currentDay: number,
    seed?: number
  ): { approvedAppeals: ClaimResolution[]; rejectedAppeals: ClaimResolution[]; remainingClaims: PendingClaim[] } {
    const approvedAppeals: ClaimResolution[] = []
    const rejectedAppeals: ClaimResolution[] = []
    const remainingClaims: PendingClaim[] = []

    let seedOffset = 0
    for (const claim of claims) {
      if (claim.status !== 'appealed' || !claim.appealSubmittedDay) {
        remainingClaims.push(claim)
        continue
      }

      const appealResolutionDay = claim.appealSubmittedDay + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS

      if (appealResolutionDay <= currentDay && claim.denialReason) {
        // Roll for appeal success based on denial reason
        const reasonDetails = DENIAL_REASONS[claim.denialReason]
        const successRate = reasonDetails?.appealSuccessRate ?? INSURANCE_CONFIG.APPEAL_SUCCESS_RATE
        const roll = seed !== undefined ? seededRandom(seed + seedOffset)() : Math.random()
        seedOffset++

        if (roll < successRate) {
          approvedAppeals.push({
            claimId: claim.id,
            paid: true,
            amount: claim.amount,
            denied: false,
          })
        } else {
          rejectedAppeals.push({
            claimId: claim.id,
            paid: false,
            amount: 0,
            denied: true,
            denialReason: claim.denialReason,
          })
        }
      } else {
        remainingClaims.push(claim)
      }
    }

    return { approvedAppeals, rejectedAppeals, remainingClaims }
  },

  /**
   * Get appealable claims
   */
  getAppealableClaims(
    claims: PendingClaim[],
    currentDay: number
  ): PendingClaim[] {
    return claims.filter((claim) => {
      const check = this.canAppealClaim(claim, currentDay)
      return check.canAppeal
    })
  },

  /**
   * Get claims with pending appeals
   */
  getClaimsWithPendingAppeals(claims: PendingClaim[]): PendingClaim[] {
    return claims.filter((claim) => claim.status === 'appealed')
  },
}

/**
 * Create a seeded random number generator
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
