import { describe, it, expect } from 'vitest'
import { InsuranceManager, INSURANCE_CONFIG } from '@/core/insurance'
import type { InsurancePanel, InsurerId, PendingClaim, Session } from '@/core/types'

// ==================== TEST DATA ====================

const createPanel = (overrides: Partial<InsurancePanel> = {}): InsurancePanel => ({
  id: 'aetna',
  name: 'Aetna',
  reimbursement: 120,
  delayDays: 21,
  denialRate: 0.08,
  applicationFee: 200,
  minReputation: 30,
  ...overrides,
})

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  therapistId: 'therapist-1',
  clientId: 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: true,
  scheduledDay: 1,
  scheduledHour: 10,
  durationMinutes: 50,
  status: 'completed',
  progress: 1,
  quality: 0.8,
  qualityModifiers: [],
  payment: 0, // Insurance payment comes from claim
  energyCost: 15,
  xpGained: 25,
  decisionsMade: [],
  therapistName: 'Dr. Test',
  clientName: 'Client A',
  ...overrides,
})

const createClaim = (overrides: Partial<PendingClaim> = {}): PendingClaim => ({
  id: 'claim-1',
  sessionId: 'session-1',
  insurerId: 'aetna',
  amount: 120,
  scheduledPaymentDay: 22,
  status: 'pending',
  ...overrides,
})

// ==================== PANEL APPLICATIONS ====================

describe('InsuranceManager - Panel Applications', () => {
  it('should allow application when requirements met', () => {
    const panel = createPanel({ minReputation: 30, applicationFee: 200 })
    const activePanels: InsurerId[] = []
    const pendingApplications: InsurerId[] = []

    const result = InsuranceManager.canApplyToPanel(
      panel,
      50, // reputation
      500, // balance
      activePanels,
      pendingApplications
    )

    expect(result.canApply).toBe(true)
  })

  it('should reject if already a member', () => {
    const panel = createPanel({ id: 'aetna' })
    const activePanels: InsurerId[] = ['aetna']

    const result = InsuranceManager.canApplyToPanel(
      panel,
      100,
      1000,
      activePanels,
      []
    )

    expect(result.canApply).toBe(false)
    expect(result.reason).toContain('Already a member')
  })

  it('should reject if application pending', () => {
    const panel = createPanel({ id: 'cigna' })
    const pendingApplications: InsurerId[] = ['cigna']

    const result = InsuranceManager.canApplyToPanel(
      panel,
      100,
      1000,
      [],
      pendingApplications
    )

    expect(result.canApply).toBe(false)
    expect(result.reason).toContain('pending')
  })

  it('should reject if reputation too low', () => {
    const panel = createPanel({ minReputation: 75 })

    const result = InsuranceManager.canApplyToPanel(
      panel,
      50, // below requirement
      1000,
      [],
      []
    )

    expect(result.canApply).toBe(false)
    expect(result.reason).toContain('Requires 75 reputation')
  })

  it('should reject if insufficient balance for fee', () => {
    const panel = createPanel({ applicationFee: 250 })

    const result = InsuranceManager.canApplyToPanel(
      panel,
      100,
      100, // not enough
      [],
      []
    )

    expect(result.canApply).toBe(false)
    expect(result.reason).toContain('Need $150 more')
  })
})

// ==================== ACCEPTANCE RATE ====================

describe('InsuranceManager - Acceptance Rate', () => {
  it('should return base rate at minimum reputation', () => {
    const panel = createPanel({ minReputation: 50 })

    const rate = InsuranceManager.calculateAcceptanceRate(panel, 50)

    expect(rate).toBeCloseTo(INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE, 2)
  })

  it('should increase rate with higher reputation', () => {
    const panel = createPanel({ minReputation: 50 })

    const lowRate = InsuranceManager.calculateAcceptanceRate(panel, 50)
    const highRate = InsuranceManager.calculateAcceptanceRate(panel, 150) // +100 above min

    expect(highRate).toBeGreaterThan(lowRate)
  })

  it('should cap at maximum rate', () => {
    const panel = createPanel({ minReputation: 0 })

    const rate = InsuranceManager.calculateAcceptanceRate(panel, 500)

    expect(rate).toBeLessThanOrEqual(INSURANCE_CONFIG.MAX_ACCEPTANCE_RATE)
  })

  it('should not go below minimum rate', () => {
    const panel = createPanel({ minReputation: 100 })

    // At exactly min reputation
    const rate = InsuranceManager.calculateAcceptanceRate(panel, 100)

    expect(rate).toBeGreaterThanOrEqual(INSURANCE_CONFIG.MIN_ACCEPTANCE_RATE)
  })
})

// ==================== APPLYING TO PANELS ====================

describe('InsuranceManager - Apply to Panel', () => {
  it('should process successful application', () => {
    const panel = createPanel()

    // Use a seed that produces acceptance
    const result = InsuranceManager.applyToPanel(
      panel,
      100, // reputation
      500, // balance
      [],
      [],
      12345 // seed
    )

    expect(result.success).toBe(true)
    expect(result.panelId).toBe(panel.id)
    expect(result.applicationFee).toBe(panel.applicationFee)
  })

  it('should fail application if requirements not met', () => {
    const panel = createPanel({ minReputation: 100 })

    const result = InsuranceManager.applyToPanel(
      panel,
      50, // too low
      500,
      [],
      []
    )

    expect(result.success).toBe(false)
    expect(result.accepted).toBe(false)
  })

  it('should randomly accept or reject based on rate', () => {
    const panel = createPanel()

    // Test multiple seeds to ensure both outcomes are possible
    let accepted = 0
    let rejected = 0

    for (let seed = 1; seed <= 100; seed++) {
      const result = InsuranceManager.applyToPanel(panel, 100, 500, [], [], seed)
      if (result.success && result.accepted) accepted++
      else if (result.success && !result.accepted) rejected++
    }

    // With ~85% acceptance rate, we should see mostly accepts but some rejects
    expect(accepted).toBeGreaterThan(50)
    expect(rejected).toBeGreaterThan(0)
  })
})

// ==================== CLAIMS ====================

describe('InsuranceManager - Claims', () => {
  it('should create claim with correct amount and date', () => {
    const session = createSession()
    const panel = createPanel({ reimbursement: 120, delayDays: 21 })
    const currentDay = 10

    const claim = InsuranceManager.createClaim(session, panel, currentDay, 1.0)

    expect(claim.sessionId).toBe(session.id)
    expect(claim.insurerId).toBe(panel.id)
    expect(claim.baseAmount).toBe(120)
    expect(claim.multipliedAmount).toBe(120)
    expect(claim.scheduledPaymentDay).toBe(31) // 10 + 21
  })

  it('should apply insurance multiplier to claim', () => {
    const session = createSession()
    const panel = createPanel({ reimbursement: 100 })

    const claim = InsuranceManager.createClaim(session, panel, 1, 1.3)

    expect(claim.baseAmount).toBe(100)
    expect(claim.multipliedAmount).toBe(130)
  })

  it('should create pending claim record', () => {
    const claimResult = {
      claimId: 'claim-123',
      sessionId: 'session-456',
      insurerId: 'bluecross' as InsurerId,
      baseAmount: 100,
      multipliedAmount: 120,
      scheduledPaymentDay: 25,
    }

    const pending = InsuranceManager.createPendingClaim(claimResult)

    expect(pending.id).toBe('claim-123')
    expect(pending.sessionId).toBe('session-456')
    expect(pending.insurerId).toBe('bluecross')
    expect(pending.amount).toBe(120)
    expect(pending.scheduledPaymentDay).toBe(25)
    expect(pending.status).toBe('pending')
  })
})

// ==================== PROCESSING CLAIMS ====================

describe('InsuranceManager - Processing Claims', () => {
  const denialRates: Record<InsurerId, number> = {
    aetna: 0.08,
    bluecross: 0.05,
    cigna: 0.10,
    united: 0.07,
    medicaid: 0.15,
  }

  it('should process due claims', () => {
    const claims = [
      createClaim({ id: 'c1', scheduledPaymentDay: 10 }),
      createClaim({ id: 'c2', scheduledPaymentDay: 15 }),
    ]
    const currentDay = 12

    const result = InsuranceManager.processDueClaims(claims, currentDay, denialRates, 99999)

    // c1 is due (day 10 <= 12), c2 is not (day 15 > 12)
    expect(result.paidClaims.length + result.deniedClaims.length).toBe(1)
    expect(result.remainingClaims.length).toBe(1)
  })

  it('should pay claims that pass denial check', () => {
    const claims = [
      createClaim({ id: 'c1', scheduledPaymentDay: 10, amount: 100 }),
    ]

    // Use seed that produces payment (roll > denial rate)
    const result = InsuranceManager.processDueClaims(claims, 15, denialRates, 99999)

    expect(result.paidClaims.length).toBe(1)
    expect(result.paidClaims[0].amount).toBe(100)
    expect(result.paidClaims[0].paid).toBe(true)
    expect(result.paidClaims[0].denied).toBe(false)
  })

  it('should deny claims that fail denial check', () => {
    const claims = [
      // Use medicaid with 15% denial rate
      createClaim({ id: 'c1', scheduledPaymentDay: 10, insurerId: 'medicaid' }),
    ]

    // Find a seed that produces denial
    let deniedResult = null
    for (let seed = 1; seed <= 100; seed++) {
      const result = InsuranceManager.processDueClaims(claims, 15, denialRates, seed)
      if (result.deniedClaims.length > 0) {
        deniedResult = result
        break
      }
    }

    expect(deniedResult).not.toBeNull()
    expect(deniedResult!.deniedClaims[0].denied).toBe(true)
    expect(deniedResult!.deniedClaims[0].amount).toBe(0)
  })

  it('should not process claims that are not pending', () => {
    const claims = [
      createClaim({ id: 'c1', scheduledPaymentDay: 5, status: 'paid' }),
      createClaim({ id: 'c2', scheduledPaymentDay: 5, status: 'denied' }),
    ]

    const result = InsuranceManager.processDueClaims(claims, 10, denialRates)

    expect(result.paidClaims.length).toBe(0)
    expect(result.deniedClaims.length).toBe(0)
    expect(result.remainingClaims.length).toBe(0)
  })
})

// ==================== CLAIM STATISTICS ====================

describe('InsuranceManager - Claim Statistics', () => {
  it('should calculate claim stats', () => {
    const claims = [
      createClaim({ id: 'c1', insurerId: 'aetna', amount: 100, scheduledPaymentDay: 10 }),
      createClaim({ id: 'c2', insurerId: 'aetna', amount: 150, scheduledPaymentDay: 15 }),
      createClaim({ id: 'c3', insurerId: 'bluecross', amount: 120, scheduledPaymentDay: 20 }),
    ]

    const stats = InsuranceManager.getClaimStats(claims)

    expect(stats.totalPending).toBe(3)
    expect(stats.totalPendingAmount).toBe(370)
    expect(stats.claimsByInsurer.aetna.count).toBe(2)
    expect(stats.claimsByInsurer.aetna.amount).toBe(250)
    expect(stats.claimsByInsurer.bluecross.count).toBe(1)
    expect(stats.oldestClaimDay).toBe(10)
  })

  it('should only count pending claims in stats', () => {
    const claims = [
      createClaim({ id: 'c1', status: 'pending', amount: 100 }),
      createClaim({ id: 'c2', status: 'paid', amount: 200 }),
    ]

    const stats = InsuranceManager.getClaimStats(claims)

    expect(stats.totalPending).toBe(1)
    expect(stats.totalPendingAmount).toBe(100)
  })
})

// ==================== EXPECTED INCOME ====================

describe('InsuranceManager - Expected Income', () => {
  const denialRates: Record<InsurerId, number> = {
    aetna: 0.10, // 10% denial
    bluecross: 0.05,
    cigna: 0.10,
    united: 0.07,
    medicaid: 0.15,
  }

  it('should calculate expected income with denial rates', () => {
    const claims = [
      createClaim({ amount: 100, insurerId: 'aetna', scheduledPaymentDay: 10 }),
    ]

    const expected = InsuranceManager.calculateExpectedIncome(
      claims,
      denialRates,
      5, // days ahead
      8 // current day (claim is due day 10, within range)
    )

    // 100 * (1 - 0.10) = 90
    expect(expected).toBe(90)
  })

  it('should only include claims within time window', () => {
    const claims = [
      createClaim({ amount: 100, scheduledPaymentDay: 10 }),
      createClaim({ amount: 100, scheduledPaymentDay: 50 }), // outside window
    ]

    const expected = InsuranceManager.calculateExpectedIncome(
      claims,
      denialRates,
      7,
      8 // Only day 10 is within 8+7=15
    )

    // Only first claim counted
    expect(expected).toBe(90)
  })
})

// ==================== CLAIMS DUE ====================

describe('InsuranceManager - Claims Due', () => {
  it('should get claims due within period', () => {
    const claims = [
      createClaim({ id: 'c1', scheduledPaymentDay: 10 }),
      createClaim({ id: 'c2', scheduledPaymentDay: 15 }),
      createClaim({ id: 'c3', scheduledPaymentDay: 25 }),
    ]

    const due = InsuranceManager.getClaimsDueWithin(claims, 8, 10)

    // Days 8-18, so c1 (day 10) and c2 (day 15) are due
    expect(due.length).toBe(2)
    expect(due.map((c) => c.id)).toContain('c1')
    expect(due.map((c) => c.id)).toContain('c2')
  })

  it('should not include past claims', () => {
    const claims = [
      createClaim({ id: 'c1', scheduledPaymentDay: 5 }),
    ]

    const due = InsuranceManager.getClaimsDueWithin(claims, 10, 7)

    expect(due.length).toBe(0)
  })
})

// ==================== MULTIPLIER ====================

describe('InsuranceManager - Multiplier', () => {
  it('should update multiplier', () => {
    const newMultiplier = InsuranceManager.updateMultiplier(1.0, 0.1)

    expect(newMultiplier).toBe(1.1)
  })

  it('should cap multiplier at max', () => {
    const newMultiplier = InsuranceManager.updateMultiplier(1.4, 0.2)

    expect(newMultiplier).toBe(INSURANCE_CONFIG.MAX_MULTIPLIER)
  })

  it('should calculate insurance payment with multiplier', () => {
    const panel = createPanel({ reimbursement: 100 })

    const payment = InsuranceManager.calculateInsurancePayment(panel, 1.3)

    expect(payment).toBe(130)
  })
})

// ==================== PANEL STATUS ====================

describe('InsuranceManager - Panel Status', () => {
  it('should return active status', () => {
    const status = InsuranceManager.getPanelStatus('aetna', ['aetna'], [])

    expect(status).toBe('active')
  })

  it('should return pending status', () => {
    const status = InsuranceManager.getPanelStatus('cigna', [], ['cigna'])

    expect(status).toBe('pending')
  })

  it('should return available status', () => {
    const status = InsuranceManager.getPanelStatus('united', [], [])

    expect(status).toBe('available')
  })
})

// ==================== PANEL SUMMARY ====================

describe('InsuranceManager - Panel Summary', () => {
  const panels: Record<InsurerId, InsurancePanel> = {
    aetna: createPanel({ id: 'aetna', reimbursement: 120, delayDays: 21 }),
    bluecross: createPanel({ id: 'bluecross', reimbursement: 130, delayDays: 28 }),
    cigna: createPanel({ id: 'cigna', reimbursement: 115, delayDays: 14 }),
    united: createPanel({ id: 'united', reimbursement: 125, delayDays: 30 }),
    medicaid: createPanel({ id: 'medicaid', reimbursement: 85, delayDays: 45 }),
  }

  it('should return summary of active panels', () => {
    const activePanels: InsurerId[] = ['aetna', 'bluecross']

    const summary = InsuranceManager.getActivePanelsSummary(activePanels, panels, 1.0)

    expect(summary.panelCount).toBe(2)
    expect(summary.averageReimbursement).toBe(125) // (120 + 130) / 2
    expect(summary.averageDelay).toBe(25) // (21 + 28) / 2 ≈ 25
  })

  it('should apply multiplier to reimbursement in summary', () => {
    const activePanels: InsurerId[] = ['aetna'] // reimbursement 120

    const summary = InsuranceManager.getActivePanelsSummary(activePanels, panels, 1.5)

    expect(summary.averageReimbursement).toBe(180) // 120 * 1.5
  })

  it('should return zeros for no active panels', () => {
    const summary = InsuranceManager.getActivePanelsSummary([], panels, 1.0)

    expect(summary.panelCount).toBe(0)
    expect(summary.averageReimbursement).toBe(0)
    expect(summary.averageDelay).toBe(0)
  })
})

// ==================== RECOMMENDATIONS ====================

describe('InsuranceManager - Recommendations', () => {
  it('should recommend more panels if none active', () => {
    const result = InsuranceManager.shouldConsiderMorePanels([], [])

    expect(result.shouldConsider).toBe(true)
    expect(result.reason).toContain('No insurance panels')
  })

  it('should recommend panels if low claim volume', () => {
    const activePanels: InsurerId[] = ['aetna']
    const claims = [createClaim()]

    const result = InsuranceManager.shouldConsiderMorePanels(activePanels, claims)

    expect(result.shouldConsider).toBe(true)
    expect(result.reason).toContain('Low claim volume')
  })

  it('should not recommend if already have enough panels', () => {
    const activePanels: InsurerId[] = ['aetna', 'bluecross', 'cigna']
    const claims: PendingClaim[] = []

    const result = InsuranceManager.shouldConsiderMorePanels(activePanels, claims)

    expect(result.shouldConsider).toBe(false)
  })
})

// ==================== CONFIG ====================

describe('INSURANCE_CONFIG', () => {
  it('should have valid configuration values', () => {
    expect(INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE).toBeGreaterThan(0.5)
    expect(INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE).toBeLessThanOrEqual(1)

    expect(INSURANCE_CONFIG.MAX_ACCEPTANCE_RATE).toBeGreaterThan(INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE)
    expect(INSURANCE_CONFIG.MIN_ACCEPTANCE_RATE).toBeLessThan(INSURANCE_CONFIG.BASE_ACCEPTANCE_RATE)

    expect(INSURANCE_CONFIG.DEFAULT_MULTIPLIER).toBe(1.0)
    expect(INSURANCE_CONFIG.MAX_MULTIPLIER).toBeGreaterThan(1.0)

    expect(INSURANCE_CONFIG.REPUTATION_ACCEPTANCE_BONUS).toBeGreaterThan(0)
    expect(INSURANCE_CONFIG.MULTIPLIER_INCREASE_PER_TRAINING).toBeGreaterThan(0)
  })
})
