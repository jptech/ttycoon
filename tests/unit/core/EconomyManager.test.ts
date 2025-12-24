import { describe, it, expect, vi } from 'vitest'
import { EconomyManager, ECONOMY_CONFIG } from '@/core/economy'
import type { Session, Client, Therapist, PendingClaim, Transaction, InsurerId } from '@/core/types'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 9),
})

describe('EconomyManager', () => {
  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'session-1',
    therapistId: 'therapist-1',
    clientId: 'client-1',
    sessionType: 'clinical',
    isVirtual: false,
    isInsurance: false,
    scheduledDay: 1,
    scheduledHour: 9,
    durationMinutes: 50,
    status: 'completed',
    progress: 1,
    quality: 0.8,
    qualityModifiers: [],
    payment: 150,
    energyCost: 10,
    xpGained: 15,
    decisionsMade: [],
    therapistName: 'Dr. Smith',
    clientName: 'Client AB',
    ...overrides,
  })

  const createMockClient = (overrides: Partial<Client> = {}): Client => ({
    id: 'client-1',
    displayName: 'Client AB',
    conditionCategory: 'anxiety',
    conditionType: 'GAD',
    severity: 5,
    sessionsRequired: 8,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'in_treatment',
    satisfaction: 70,
    engagement: 75,
    isPrivatePay: true,
    insuranceProvider: null,
    sessionRate: 150,
    prefersVirtual: false,
    preferredFrequency: 'weekly',
    preferredTime: 'morning',
    availability: {
      monday: [9, 10, 11],
      tuesday: [9, 10, 11],
      wednesday: [9, 10, 11],
      thursday: [9, 10, 11],
      friday: [9, 10, 11],
    },
    requiredCertification: null,
    isMinor: false,
    isCouple: false,
    arrivalDay: 1,
    daysWaiting: 0,
    maxWaitDays: 14,
    assignedTherapistId: 'therapist-1',
    ...overrides,
  })

  const createMockTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
    id: 'therapist-1',
    displayName: 'Dr. Smith',
    isPlayer: true,
    energy: 80,
    maxEnergy: 100,
    baseSkill: 60,
    level: 1,
    xp: 0,
    hourlySalary: 0,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 7, analytical: 6, creativity: 5 },
    ...overrides,
  })

  describe('calculateSessionPayment', () => {
    it('calculates base payment for 50-minute session', () => {
      const session = createMockSession({ durationMinutes: 50 })
      const client = createMockClient({ sessionRate: 150 })

      const payment = EconomyManager.calculateSessionPayment(session, client)

      expect(payment).toBe(150)
    })

    it('applies extended session multiplier for 80-minute session', () => {
      const session = createMockSession({ durationMinutes: 80 })
      const client = createMockClient({ sessionRate: 150 })

      const payment = EconomyManager.calculateSessionPayment(session, client)

      expect(payment).toBe(Math.round(150 * ECONOMY_CONFIG.EXTENDED_SESSION_MULTIPLIER))
    })

    it('applies intensive session multiplier for 180-minute session', () => {
      const session = createMockSession({ durationMinutes: 180 })
      const client = createMockClient({ sessionRate: 150 })

      const payment = EconomyManager.calculateSessionPayment(session, client)

      expect(payment).toBe(Math.round(150 * ECONOMY_CONFIG.INTENSIVE_SESSION_MULTIPLIER))
    })

    it('uses client session rate', () => {
      const session = createMockSession({ durationMinutes: 50 })
      const client = createMockClient({ sessionRate: 200 })

      const payment = EconomyManager.calculateSessionPayment(session, client)

      expect(payment).toBe(200)
    })
  })

  describe('processSessionPayment', () => {
    it('returns immediate payment for private pay clients', () => {
      const session = createMockSession()
      const client = createMockClient({ isPrivatePay: true })

      const result = EconomyManager.processSessionPayment(
        session,
        client,
        null,
        0,
        1
      )

      expect(result.immediatePayment).toBe(150)
      expect(result.claim).toBeUndefined()
      expect(result.transaction.type).toBe('income')
      expect(result.transaction.amount).toBe(150)
      expect(result.transaction.category).toBe('session_payment')
    })

    it('creates pending claim for insurance clients', () => {
      const session = createMockSession()
      const client = createMockClient({
        isPrivatePay: false,
        insuranceProvider: 'aetna',
        sessionRate: 150,
      })

      const result = EconomyManager.processSessionPayment(
        session,
        client,
        120, // Insurance reimbursement
        21, // Delay days
        1
      )

      expect(result.immediatePayment).toBe(0)
      expect(result.claim).toBeDefined()
      expect(result.claim!.insurerId).toBe('aetna')
      expect(result.claim!.amount).toBe(120)
      expect(result.claim!.scheduledPaymentDay).toBe(22) // 1 + 21
      expect(result.claim!.status).toBe('pending')
    })

    it('uses payment amount if no reimbursement specified', () => {
      const session = createMockSession()
      const client = createMockClient({
        isPrivatePay: false,
        insuranceProvider: 'aetna',
        sessionRate: 150,
      })

      const result = EconomyManager.processSessionPayment(
        session,
        client,
        null,
        21,
        1
      )

      expect(result.claim!.amount).toBe(150)
    })
  })

  describe('processPendingClaims', () => {
    const createMockClaim = (overrides: Partial<PendingClaim> = {}): PendingClaim => ({
      id: 'claim-1',
      sessionId: 'session-1',
      insurerId: 'aetna',
      amount: 120,
      scheduledPaymentDay: 10,
      status: 'pending',
      ...overrides,
    })

    it('processes claims due on current day', () => {
      const claims = [createMockClaim({ scheduledPaymentDay: 10 })]
      const denialRates: Record<InsurerId, number> = {
        aetna: 0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.paidClaims.length).toBe(1)
      expect(result.deniedClaims.length).toBe(0)
      expect(result.totalPaid).toBe(120)
    })

    it('skips claims not yet due', () => {
      const claims = [createMockClaim({ scheduledPaymentDay: 15 })]
      const denialRates: Record<InsurerId, number> = {
        aetna: 0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.paidClaims.length).toBe(0)
      expect(result.deniedClaims.length).toBe(0)
    })

    it('processes overdue claims', () => {
      const claims = [createMockClaim({ scheduledPaymentDay: 5 })]
      const denialRates: Record<InsurerId, number> = {
        aetna: 0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.paidClaims.length).toBe(1)
    })

    it('denies claims based on denial rate', () => {
      // Force denial with 100% rate
      const claims = [createMockClaim()]
      const denialRates: Record<InsurerId, number> = {
        aetna: 1, // 100% denial
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.deniedClaims.length).toBe(1)
      expect(result.paidClaims.length).toBe(0)
      expect(result.totalDenied).toBe(120)
    })

    it('creates transactions for paid claims', () => {
      const claims = [createMockClaim()]
      const denialRates: Record<InsurerId, number> = {
        aetna: 0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.transactions.length).toBe(1)
      expect(result.transactions[0].type).toBe('income')
      expect(result.transactions[0].category).toBe('insurance_payment')
    })

    it('skips already processed claims', () => {
      const claims = [createMockClaim({ status: 'paid' })]
      const denialRates: Record<InsurerId, number> = {
        aetna: 0,
        bluecross: 0,
        cigna: 0,
        united: 0,
        medicaid: 0,
      }

      const result = EconomyManager.processPendingClaims(claims, 10, denialRates)

      expect(result.paidClaims.length).toBe(0)
      expect(result.deniedClaims.length).toBe(0)
    })
  })

  describe('calculateDailyExpenses', () => {
    it('calculates daily rent from monthly', () => {
      const result = EconomyManager.calculateDailyExpenses(3000, [], 1)

      expect(result.breakdown.rent).toBe(100) // 3000 / 30
      expect(result.totalExpenses).toBe(100)
    })

    it('calculates salaries for hired therapists', () => {
      const therapists = [
        createMockTherapist({ isPlayer: true, hourlySalary: 0 }),
        createMockTherapist({
          id: 'therapist-2',
          isPlayer: false,
          hourlySalary: 25,
        }),
      ]

      const result = EconomyManager.calculateDailyExpenses(0, therapists, 1)

      expect(result.breakdown.salaries).toBe(200) // 25 * 8 hours
      expect(result.transactions.length).toBe(1) // Only salary transaction
    })

    it('excludes player therapist from salary calculations', () => {
      const therapists = [createMockTherapist({ isPlayer: true, hourlySalary: 50 })]

      const result = EconomyManager.calculateDailyExpenses(0, therapists, 1)

      expect(result.breakdown.salaries).toBe(0)
    })

    it('creates separate transactions for rent and each therapist', () => {
      const therapists = [
        createMockTherapist({
          id: 'therapist-2',
          isPlayer: false,
          hourlySalary: 25,
        }),
        createMockTherapist({
          id: 'therapist-3',
          isPlayer: false,
          hourlySalary: 30,
        }),
      ]

      const result = EconomyManager.calculateDailyExpenses(3000, therapists, 1)

      expect(result.transactions.length).toBe(3) // rent + 2 salaries
      expect(result.transactions.every((t) => t.type === 'expense')).toBe(true)
    })
  })

  describe('calculateBudgetSummary', () => {
    it('calculates correct budget summary', () => {
      const pendingClaims: PendingClaim[] = [
        {
          id: 'claim-1',
          sessionId: 'session-1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'pending',
        },
        {
          id: 'claim-2',
          sessionId: 'session-2',
          insurerId: 'bluecross',
          amount: 150,
          scheduledPaymentDay: 15,
          status: 'pending',
        },
      ]

      const therapists = [
        createMockTherapist({
          id: 'therapist-2',
          isPlayer: false,
          hourlySalary: 25,
        }),
      ]

      const result = EconomyManager.calculateBudgetSummary(5000, pendingClaims, 3000, therapists)

      expect(result.currentBalance).toBe(5000)
      expect(result.pendingIncome).toBe(250)
      expect(result.dailyExpenses).toBe(300) // 100 rent + 200 salary
      expect(result.weeklyProjection).toBe(2100)
      expect(result.monthlyProjection).toBe(9000)
      expect(result.runway).toBe(16) // 5000 / 300
    })

    it('excludes non-pending claims from pending income', () => {
      const pendingClaims: PendingClaim[] = [
        {
          id: 'claim-1',
          sessionId: 'session-1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'paid',
        },
      ]

      const result = EconomyManager.calculateBudgetSummary(5000, pendingClaims, 0, [])

      expect(result.pendingIncome).toBe(0)
    })

    it('returns Infinity runway when no expenses', () => {
      const result = EconomyManager.calculateBudgetSummary(5000, [], 0, [])

      expect(result.runway).toBe(Infinity)
    })
  })

  describe('getDailyIncome', () => {
    it('sums income transactions for a day', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
        {
          id: '2',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
        {
          id: '3',
          day: 1,
          type: 'expense',
          category: 'rent',
          amount: 100,
          description: '',
        },
        {
          id: '4',
          day: 2,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
      ]

      const income = EconomyManager.getDailyIncome(transactions, 1)

      expect(income).toBe(300)
    })
  })

  describe('getDailyExpenses', () => {
    it('sums expense transactions for a day', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          day: 1,
          type: 'expense',
          category: 'rent',
          amount: 100,
          description: '',
        },
        {
          id: '2',
          day: 1,
          type: 'expense',
          category: 'salary',
          amount: 200,
          description: '',
        },
        {
          id: '3',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
      ]

      const expenses = EconomyManager.getDailyExpenses(transactions, 1)

      expect(expenses).toBe(300)
    })
  })

  describe('getDailyNet', () => {
    it('calculates net income/expense for a day', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 300,
          description: '',
        },
        {
          id: '2',
          day: 1,
          type: 'expense',
          category: 'rent',
          amount: 100,
          description: '',
        },
      ]

      const net = EconomyManager.getDailyNet(transactions, 1)

      expect(net).toBe(200)
    })

    it('returns negative when expenses exceed income', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 100,
          description: '',
        },
        {
          id: '2',
          day: 1,
          type: 'expense',
          category: 'rent',
          amount: 300,
          description: '',
        },
      ]

      const net = EconomyManager.getDailyNet(transactions, 1)

      expect(net).toBe(-200)
    })
  })

  describe('getTransactionsByCategory', () => {
    it('groups transactions by category', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
        {
          id: '2',
          day: 1,
          type: 'income',
          category: 'session_payment',
          amount: 150,
          description: '',
        },
        {
          id: '3',
          day: 1,
          type: 'expense',
          category: 'rent',
          amount: 100,
          description: '',
        },
        {
          id: '4',
          day: 1,
          type: 'expense',
          category: 'salary',
          amount: 200,
          description: '',
        },
      ]

      const byCategory = EconomyManager.getTransactionsByCategory(transactions)

      expect(byCategory['session_payment']).toEqual({ income: 300, expense: 0 })
      expect(byCategory['rent']).toEqual({ income: 0, expense: 100 })
      expect(byCategory['salary']).toEqual({ income: 0, expense: 200 })
    })
  })

  describe('formatCurrency', () => {
    it('formats positive amounts', () => {
      expect(EconomyManager.formatCurrency(1234)).toBe('$1,234')
    })

    it('formats zero', () => {
      expect(EconomyManager.formatCurrency(0)).toBe('$0')
    })

    it('formats negative amounts', () => {
      expect(EconomyManager.formatCurrency(-500)).toBe('-$500')
    })
  })

  describe('formatCurrencyWithSign', () => {
    it('adds + sign to positive amounts', () => {
      expect(EconomyManager.formatCurrencyWithSign(100)).toBe('+$100')
    })

    it('adds - sign to negative amounts', () => {
      expect(EconomyManager.formatCurrencyWithSign(-100)).toBe('-$100')
    })

    it('formats zero without sign', () => {
      expect(EconomyManager.formatCurrencyWithSign(0)).toBe('$0')
    })
  })

  describe('canAfford', () => {
    it('returns true when balance is sufficient', () => {
      expect(EconomyManager.canAfford(1000, 500)).toBe(true)
    })

    it('returns true when balance equals cost', () => {
      expect(EconomyManager.canAfford(500, 500)).toBe(true)
    })

    it('returns false when balance is insufficient', () => {
      expect(EconomyManager.canAfford(400, 500)).toBe(false)
    })
  })

  describe('getClaimsByStatus', () => {
    it('filters claims by status', () => {
      const claims: PendingClaim[] = [
        {
          id: '1',
          sessionId: 's1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'pending',
        },
        {
          id: '2',
          sessionId: 's2',
          insurerId: 'bluecross',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'paid',
        },
        {
          id: '3',
          sessionId: 's3',
          insurerId: 'cigna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'pending',
        },
      ]

      const pending = EconomyManager.getClaimsByStatus(claims, 'pending')
      const paid = EconomyManager.getClaimsByStatus(claims, 'paid')

      expect(pending.length).toBe(2)
      expect(paid.length).toBe(1)
    })
  })

  describe('getOverdueClaims', () => {
    it('identifies overdue claims', () => {
      const claims: PendingClaim[] = [
        {
          id: '1',
          sessionId: 's1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'pending',
        },
        {
          id: '2',
          sessionId: 's2',
          insurerId: 'bluecross',
          amount: 100,
          scheduledPaymentDay: 50,
          status: 'pending',
        },
      ]

      const overdue = EconomyManager.getOverdueClaims(claims, 100)

      expect(overdue.length).toBe(1)
      expect(overdue[0].id).toBe('1')
    })

    it('excludes paid claims from overdue', () => {
      const claims: PendingClaim[] = [
        {
          id: '1',
          sessionId: 's1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'paid',
        },
      ]

      const overdue = EconomyManager.getOverdueClaims(claims, 100)

      expect(overdue.length).toBe(0)
    })
  })

  describe('getPendingClaimsByInsurer', () => {
    it('groups pending claims by insurer', () => {
      const claims: PendingClaim[] = [
        {
          id: '1',
          sessionId: 's1',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'pending',
        },
        {
          id: '2',
          sessionId: 's2',
          insurerId: 'aetna',
          amount: 120,
          scheduledPaymentDay: 15,
          status: 'pending',
        },
        {
          id: '3',
          sessionId: 's3',
          insurerId: 'bluecross',
          amount: 130,
          scheduledPaymentDay: 20,
          status: 'pending',
        },
        {
          id: '4',
          sessionId: 's4',
          insurerId: 'aetna',
          amount: 100,
          scheduledPaymentDay: 10,
          status: 'paid', // Should be excluded
        },
      ]

      const byInsurer = EconomyManager.getPendingClaimsByInsurer(claims)

      expect(byInsurer['aetna']).toBe(220)
      expect(byInsurer['bluecross']).toBe(130)
    })
  })

  describe('getRecentTransactions', () => {
    it('returns transactions within day range', () => {
      const transactions: Transaction[] = [
        { id: '1', day: 10, type: 'income', category: '', amount: 100, description: '' },
        { id: '2', day: 8, type: 'income', category: '', amount: 100, description: '' },
        { id: '3', day: 5, type: 'income', category: '', amount: 100, description: '' },
        { id: '4', day: 1, type: 'income', category: '', amount: 100, description: '' },
      ]

      const recent = EconomyManager.getRecentTransactions(transactions, 10, 7)

      expect(recent.length).toBe(3)
      expect(recent.map((t) => t.day)).toEqual([10, 8, 5])
    })

    it('sorts by day descending', () => {
      const transactions: Transaction[] = [
        { id: '1', day: 5, type: 'income', category: '', amount: 100, description: '' },
        { id: '2', day: 10, type: 'income', category: '', amount: 100, description: '' },
        { id: '3', day: 7, type: 'income', category: '', amount: 100, description: '' },
      ]

      const recent = EconomyManager.getRecentTransactions(transactions, 10, 30)

      expect(recent.map((t) => t.day)).toEqual([10, 7, 5])
    })
  })
})
