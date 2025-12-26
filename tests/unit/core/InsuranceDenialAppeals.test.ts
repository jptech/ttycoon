import { describe, it, expect } from 'vitest'
import { InsuranceManager, INSURANCE_CONFIG, DENIAL_REASONS } from '@/core/insurance'
import type { PendingClaim, InsurerId, DenialReason } from '@/core/types'

// Helper to create a test claim
function createTestClaim(overrides: Partial<PendingClaim> = {}): PendingClaim {
  return {
    id: 'claim-1',
    sessionId: 'session-1',
    insurerId: 'aetna' as InsurerId,
    amount: 100,
    scheduledPaymentDay: 10,
    status: 'pending',
    ...overrides,
  }
}

describe('Insurance Denial Reasons', () => {
  describe('selectDenialReason', () => {
    it('returns a valid denial reason', () => {
      const reason = InsuranceManager.selectDenialReason(12345)

      const validReasons: DenialReason[] = [
        'insufficient_documentation',
        'medical_necessity',
        'session_limit_exceeded',
        'coding_error',
        'prior_auth_required',
        'out_of_network',
      ]

      expect(validReasons).toContain(reason)
    })

    it('produces deterministic results with same seed', () => {
      const reason1 = InsuranceManager.selectDenialReason(42)
      const reason2 = InsuranceManager.selectDenialReason(42)

      expect(reason1).toBe(reason2)
    })

    it('produces different results with different seeds', () => {
      const reasons = new Set<DenialReason>()

      for (let seed = 0; seed < 100; seed++) {
        reasons.add(InsuranceManager.selectDenialReason(seed))
      }

      // Should get variety of reasons
      expect(reasons.size).toBeGreaterThan(1)
    })
  })

  describe('getDenialReasonDetails', () => {
    it('returns details for all denial reasons', () => {
      const reasons: DenialReason[] = [
        'insufficient_documentation',
        'medical_necessity',
        'session_limit_exceeded',
        'coding_error',
        'prior_auth_required',
        'out_of_network',
      ]

      for (const reason of reasons) {
        const details = InsuranceManager.getDenialReasonDetails(reason)

        expect(details).toHaveProperty('label')
        expect(details).toHaveProperty('description')
        expect(details).toHaveProperty('appealSuccessRate')
        expect(details.label).toBeTruthy()
        expect(details.description).toBeTruthy()
        expect(details.appealSuccessRate).toBeGreaterThanOrEqual(0)
        expect(details.appealSuccessRate).toBeLessThanOrEqual(1)
      }
    })

    it('coding_error has highest appeal success rate', () => {
      const codingError = InsuranceManager.getDenialReasonDetails('coding_error')
      const otherReasons: DenialReason[] = [
        'insufficient_documentation',
        'medical_necessity',
        'session_limit_exceeded',
        'prior_auth_required',
        'out_of_network',
      ]

      for (const reason of otherReasons) {
        const details = InsuranceManager.getDenialReasonDetails(reason)
        expect(codingError.appealSuccessRate).toBeGreaterThanOrEqual(details.appealSuccessRate)
      }
    })

    it('out_of_network has lowest appeal success rate', () => {
      const outOfNetwork = InsuranceManager.getDenialReasonDetails('out_of_network')
      const otherReasons: DenialReason[] = [
        'insufficient_documentation',
        'medical_necessity',
        'session_limit_exceeded',
        'coding_error',
        'prior_auth_required',
      ]

      for (const reason of otherReasons) {
        const details = InsuranceManager.getDenialReasonDetails(reason)
        expect(outOfNetwork.appealSuccessRate).toBeLessThanOrEqual(details.appealSuccessRate)
      }
    })
  })

  describe('processDueClaims with denial reasons', () => {
    it('sets denial reason on denied claims', () => {
      const claims: PendingClaim[] = [
        createTestClaim({ scheduledPaymentDay: 5 }),
      ]

      const denialRates: Record<InsurerId, number> = {
        aetna: 1.0, // Always deny
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = InsuranceManager.processDueClaims(claims, 10, denialRates, 42)

      expect(result.deniedClaims).toHaveLength(1)
      expect(result.deniedClaims[0].denialReason).toBeDefined()
      expect(result.deniedClaims[0].appealDeadlineDay).toBeDefined()
    })

    it('sets appeal deadline to current day + APPEAL_WINDOW_DAYS', () => {
      const claims: PendingClaim[] = [
        createTestClaim({ scheduledPaymentDay: 5 }),
      ]

      const denialRates: Record<InsurerId, number> = {
        aetna: 1.0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const currentDay = 10
      const result = InsuranceManager.processDueClaims(claims, currentDay, denialRates, 42)

      expect(result.deniedClaims[0].appealDeadlineDay).toBe(
        currentDay + INSURANCE_CONFIG.APPEAL_WINDOW_DAYS
      )
    })

    it('paid claims do not have denial reason', () => {
      const claims: PendingClaim[] = [
        createTestClaim({ scheduledPaymentDay: 5 }),
      ]

      const denialRates: Record<InsurerId, number> = {
        aetna: 0, // Never deny
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = InsuranceManager.processDueClaims(claims, 10, denialRates, 42)

      expect(result.paidClaims).toHaveLength(1)
      expect(result.paidClaims[0].denialReason).toBeUndefined()
    })
  })
})

describe('Insurance Appeals', () => {
  describe('canAppealClaim', () => {
    it('returns true for denied claim within deadline', () => {
      const claim = createTestClaim({
        status: 'denied',
        denialReason: 'insufficient_documentation',
        appealDeadlineDay: 20,
      })

      const result = InsuranceManager.canAppealClaim(claim, 15)

      expect(result.canAppeal).toBe(true)
    })

    it('returns false for non-denied claims', () => {
      const claim = createTestClaim({ status: 'pending' })

      const result = InsuranceManager.canAppealClaim(claim, 15)

      expect(result.canAppeal).toBe(false)
      expect(result.reason).toContain('denied')
    })

    it('returns false after deadline has passed', () => {
      const claim = createTestClaim({
        status: 'denied',
        denialReason: 'medical_necessity',
        appealDeadlineDay: 10,
      })

      const result = InsuranceManager.canAppealClaim(claim, 15)

      expect(result.canAppeal).toBe(false)
      expect(result.reason).toContain('deadline')
    })

    it('returns false for already appealed claims', () => {
      const claim = createTestClaim({
        status: 'denied',
        denialReason: 'coding_error',
        appealDeadlineDay: 20,
        appealSubmittedDay: 12,
      })

      const result = InsuranceManager.canAppealClaim(claim, 15)

      expect(result.canAppeal).toBe(false)
      expect(result.reason).toContain('already submitted')
    })

    it('returns false for claims without denial reason', () => {
      const claim = createTestClaim({
        status: 'denied',
        appealDeadlineDay: 20,
      })

      const result = InsuranceManager.canAppealClaim(claim, 15)

      expect(result.canAppeal).toBe(false)
    })
  })

  describe('submitAppeal', () => {
    it('succeeds for valid claim', () => {
      const claim = createTestClaim({
        status: 'denied',
        denialReason: 'insufficient_documentation',
        appealDeadlineDay: 20,
      })

      const result = InsuranceManager.submitAppeal(claim, 15)

      expect(result.success).toBe(true)
      expect(result.claimId).toBe(claim.id)
      expect(result.newPaymentDay).toBe(15 + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS)
    })

    it('fails for non-appealable claim', () => {
      const claim = createTestClaim({ status: 'pending' })

      const result = InsuranceManager.submitAppeal(claim, 15)

      expect(result.success).toBe(false)
      expect(result.reason).toBeDefined()
    })
  })

  describe('processAppeals', () => {
    it('processes appealed claims after processing period', () => {
      const claims: PendingClaim[] = [
        createTestClaim({
          status: 'appealed',
          denialReason: 'coding_error', // 85% success rate
          appealSubmittedDay: 10,
        }),
      ]

      const currentDay = 10 + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS + 1

      const result = InsuranceManager.processAppeals(claims, currentDay, 42)

      // Should be resolved (either approved or rejected)
      expect(
        result.approvedAppeals.length + result.rejectedAppeals.length
      ).toBe(1)
      expect(result.remainingClaims).toHaveLength(0)
    })

    it('keeps claims pending before processing period ends', () => {
      const claims: PendingClaim[] = [
        createTestClaim({
          status: 'appealed',
          denialReason: 'coding_error',
          appealSubmittedDay: 10,
        }),
      ]

      const currentDay = 10 + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS - 1

      const result = InsuranceManager.processAppeals(claims, currentDay, 42)

      expect(result.approvedAppeals).toHaveLength(0)
      expect(result.rejectedAppeals).toHaveLength(0)
      expect(result.remainingClaims).toHaveLength(1)
    })

    it('uses denial reason success rate', () => {
      // coding_error has 85% success rate - should mostly succeed
      let approvedCount = 0
      const iterations = 100

      for (let seed = 0; seed < iterations; seed++) {
        const claims: PendingClaim[] = [
          createTestClaim({
            status: 'appealed',
            denialReason: 'coding_error',
            appealSubmittedDay: 10,
          }),
        ]

        const result = InsuranceManager.processAppeals(
          claims,
          10 + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS + 1,
          seed
        )

        if (result.approvedAppeals.length > 0) {
          approvedCount++
        }
      }

      // Should be roughly 85% approval rate (±15% tolerance)
      const approvalRate = approvedCount / iterations
      expect(approvalRate).toBeGreaterThan(0.7)
      expect(approvalRate).toBeLessThan(1.0)
    })

    it('out_of_network has low approval rate', () => {
      let approvedCount = 0
      const iterations = 100

      for (let seed = 0; seed < iterations; seed++) {
        const claims: PendingClaim[] = [
          createTestClaim({
            status: 'appealed',
            denialReason: 'out_of_network', // 10% success rate
            appealSubmittedDay: 10,
          }),
        ]

        const result = InsuranceManager.processAppeals(
          claims,
          10 + INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS + 1,
          seed
        )

        if (result.approvedAppeals.length > 0) {
          approvedCount++
        }
      }

      // Should be roughly 10% approval rate (±15% tolerance)
      const approvalRate = approvedCount / iterations
      expect(approvalRate).toBeLessThan(0.25)
    })
  })

  describe('getAppealableClaims', () => {
    it('returns only appealable claims', () => {
      const claims: PendingClaim[] = [
        createTestClaim({
          id: 'claim-1',
          status: 'denied',
          denialReason: 'coding_error',
          appealDeadlineDay: 20,
        }),
        createTestClaim({
          id: 'claim-2',
          status: 'pending', // Not appealable
        }),
        createTestClaim({
          id: 'claim-3',
          status: 'denied',
          denialReason: 'medical_necessity',
          appealDeadlineDay: 5, // Past deadline
        }),
      ]

      const appealable = InsuranceManager.getAppealableClaims(claims, 15)

      expect(appealable).toHaveLength(1)
      expect(appealable[0].id).toBe('claim-1')
    })
  })

  describe('getClaimsWithPendingAppeals', () => {
    it('returns only claims with pending appeals', () => {
      const claims: PendingClaim[] = [
        createTestClaim({ id: 'claim-1', status: 'appealed' }),
        createTestClaim({ id: 'claim-2', status: 'pending' }),
        createTestClaim({ id: 'claim-3', status: 'denied' }),
        createTestClaim({ id: 'claim-4', status: 'appealed' }),
      ]

      const pending = InsuranceManager.getClaimsWithPendingAppeals(claims)

      expect(pending).toHaveLength(2)
      expect(pending.map((c) => c.id)).toEqual(['claim-1', 'claim-4'])
    })
  })
})

describe('DENIAL_REASONS configuration', () => {
  it('all reasons have required properties', () => {
    const reasons = Object.keys(DENIAL_REASONS) as DenialReason[]

    for (const reason of reasons) {
      const details = DENIAL_REASONS[reason]

      expect(details.label).toBeTruthy()
      expect(details.description).toBeTruthy()
      expect(typeof details.appealSuccessRate).toBe('number')
      expect(details.appealSuccessRate).toBeGreaterThanOrEqual(0)
      expect(details.appealSuccessRate).toBeLessThanOrEqual(1)
    }
  })

  it('appeal success rates vary appropriately', () => {
    // Easily correctable issues should have higher success rates
    expect(DENIAL_REASONS.coding_error.appealSuccessRate).toBeGreaterThan(
      DENIAL_REASONS.out_of_network.appealSuccessRate
    )

    // Documentation issues should be correctable
    expect(DENIAL_REASONS.insufficient_documentation.appealSuccessRate).toBeGreaterThan(0.5)

    // Policy limits are harder to appeal
    expect(DENIAL_REASONS.session_limit_exceeded.appealSuccessRate).toBeLessThan(0.5)
  })
})

describe('INSURANCE_CONFIG appeal settings', () => {
  it('appeal window is reasonable', () => {
    expect(INSURANCE_CONFIG.APPEAL_WINDOW_DAYS).toBeGreaterThanOrEqual(7)
    expect(INSURANCE_CONFIG.APPEAL_WINDOW_DAYS).toBeLessThanOrEqual(30)
  })

  it('appeal processing time is reasonable', () => {
    expect(INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS).toBeGreaterThanOrEqual(3)
    expect(INSURANCE_CONFIG.APPEAL_PROCESSING_DAYS).toBeLessThanOrEqual(14)
  })

  it('base appeal success rate is moderate', () => {
    expect(INSURANCE_CONFIG.APPEAL_SUCCESS_RATE).toBeGreaterThan(0.3)
    expect(INSURANCE_CONFIG.APPEAL_SUCCESS_RATE).toBeLessThan(0.7)
  })
})
