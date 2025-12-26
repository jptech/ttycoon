import type {
  Session,
  Client,
  Therapist,
  PendingClaim,
  Transaction,
  InsurerId,
} from '@/core/types'

/**
 * Configuration for economy calculations
 */
export const ECONOMY_CONFIG = {
  /** Base session rate for private pay */
  BASE_SESSION_RATE: 150,
  /** Rate modifier for 80-minute sessions */
  EXTENDED_SESSION_MULTIPLIER: 1.5,
  /** Rate modifier for 180-minute (3hr) sessions */
  INTENSIVE_SESSION_MULTIPLIER: 3,
  /** Daily rent divisor (monthly rent / 30) */
  RENT_DAILY_DIVISOR: 30,
  /** Minimum days before insurance pays */
  MIN_INSURANCE_DELAY: 7,
  /** Maximum days before insurance pays */
  MAX_INSURANCE_DELAY: 45,
  /** Late payment fee percentage */
  LATE_PAYMENT_FEE: 0.1,
  /** Days until a claim is considered overdue */
  CLAIM_OVERDUE_DAYS: 60,
} as const

/**
 * Result of processing a session payment
 */
export interface PaymentResult {
  immediatePayment: number
  claim?: PendingClaim
  transaction: Transaction
}

/**
 * Result of processing daily expenses
 */
export interface DailyExpenseResult {
  totalExpenses: number
  transactions: Transaction[]
  breakdown: {
    rent: number
    salaries: number
  }
}

/**
 * Result of processing pending claims
 */
export interface ClaimProcessingResult {
  paidClaims: PendingClaim[]
  deniedClaims: PendingClaim[]
  totalPaid: number
  totalDenied: number
  transactions: Transaction[]
}

/**
 * Budget summary for UI display
 */
export interface BudgetSummary {
  currentBalance: number
  pendingIncome: number
  dailyExpenses: number
  weeklyProjection: number
  monthlyProjection: number
  runway: number // Days until broke at current rate
}

/**
 * Pure economy management functions
 */
export const EconomyManager = {
  /**
   * Calculate session payment based on session type and client
   */
  calculateSessionPayment(session: Session, client: Client): number {
    let baseRate = client.sessionRate

    // Apply duration modifier
    if (session.durationMinutes === 80) {
      baseRate *= ECONOMY_CONFIG.EXTENDED_SESSION_MULTIPLIER
    } else if (session.durationMinutes === 180) {
      baseRate *= ECONOMY_CONFIG.INTENSIVE_SESSION_MULTIPLIER
    }

    return Math.round(baseRate)
  },

  /**
   * Process payment for a completed session
   * Returns either immediate payment (private pay) or creates an insurance claim
   */
  processSessionPayment(
    session: Session,
    client: Client,
    insuranceReimbursement: number | null,
    insuranceDelayDays: number,
    currentDay: number
  ): PaymentResult {
    const paymentAmount = this.calculateSessionPayment(session, client)

    // Private pay - immediate payment
    if (client.isPrivatePay || !client.insuranceProvider) {
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        day: currentDay,
        type: 'income',
        category: 'session_payment',
        amount: paymentAmount,
        description: `Session payment from ${client.displayName} (private pay)`,
      }

      return {
        immediatePayment: paymentAmount,
        transaction,
      }
    }

    // Insurance - create pending claim
    const claimAmount = insuranceReimbursement ?? paymentAmount
    const scheduledPaymentDay = currentDay + insuranceDelayDays

    const claim: PendingClaim = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      insurerId: client.insuranceProvider,
      amount: claimAmount,
      scheduledPaymentDay,
      status: 'pending',
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      day: currentDay,
      type: 'income',
      category: 'insurance_claim_submitted',
      amount: 0, // No immediate payment
      description: `Insurance claim submitted for ${client.displayName} - $${claimAmount} expected on day ${scheduledPaymentDay}`,
    }

    return {
      immediatePayment: 0,
      claim,
      transaction,
    }
  },

  /**
   * Process pending insurance claims for a given day
   */
  processPendingClaims(
    claims: PendingClaim[],
    currentDay: number,
    denialRates: Record<InsurerId, number>
  ): ClaimProcessingResult {
    const paidClaims: PendingClaim[] = []
    const deniedClaims: PendingClaim[] = []
    const transactions: Transaction[] = []
    let totalPaid = 0
    let totalDenied = 0

    for (const claim of claims) {
      if (claim.status !== 'pending') continue
      if (claim.scheduledPaymentDay > currentDay) continue

      // Check for denial
      // HIGH-019 fix: Clamp denial rate to valid probability range [0, 1]
      const rawDenialRate = denialRates[claim.insurerId] ?? 0.05
      const denialRate = Math.max(0, Math.min(1, rawDenialRate))
      const isDenied = Math.random() < denialRate

      if (isDenied) {
        const deniedClaim: PendingClaim = {
          ...claim,
          status: 'denied',
        }
        deniedClaims.push(deniedClaim)
        totalDenied += claim.amount

        transactions.push({
          id: crypto.randomUUID(),
          day: currentDay,
          type: 'expense',
          category: 'insurance_denied',
          amount: 0,
          description: `Insurance claim denied by ${claim.insurerId} - $${claim.amount} lost`,
        })
      } else {
        const paidClaim: PendingClaim = {
          ...claim,
          status: 'paid',
        }
        paidClaims.push(paidClaim)
        totalPaid += claim.amount

        transactions.push({
          id: crypto.randomUUID(),
          day: currentDay,
          type: 'income',
          category: 'insurance_payment',
          amount: claim.amount,
          description: `Insurance payment from ${claim.insurerId}`,
        })
      }
    }

    return {
      paidClaims,
      deniedClaims,
      totalPaid,
      totalDenied,
      transactions,
    }
  },

  /**
   * Calculate daily expenses (rent + salaries)
   */
  calculateDailyExpenses(
    monthlyRent: number,
    therapists: Therapist[],
    currentDay: number
  ): DailyExpenseResult {
    const transactions: Transaction[] = []

    // Daily rent (monthly / 30)
    const dailyRent = Math.round(monthlyRent / ECONOMY_CONFIG.RENT_DAILY_DIVISOR)

    if (dailyRent > 0) {
      transactions.push({
        id: crypto.randomUUID(),
        day: currentDay,
        type: 'expense',
        category: 'rent',
        amount: dailyRent,
        description: 'Daily office rent',
      })
    }

    // Salaries (only for non-player therapists)
    // Paid per session hour, but we calculate a daily rate (assume 8 hour day)
    let totalSalaries = 0
    const hiredTherapists = therapists.filter((t) => !t.isPlayer)

    for (const therapist of hiredTherapists) {
      // Daily salary = hourly * 8 (simplified)
      const dailySalary = therapist.hourlySalary * 8
      if (dailySalary > 0) {
        totalSalaries += dailySalary
        transactions.push({
          id: crypto.randomUUID(),
          day: currentDay,
          type: 'expense',
          category: 'salary',
          amount: dailySalary,
          description: `Salary for ${therapist.displayName}`,
        })
      }
    }

    return {
      totalExpenses: dailyRent + totalSalaries,
      transactions,
      breakdown: {
        rent: dailyRent,
        salaries: totalSalaries,
      },
    }
  },

  /**
   * Calculate budget summary for planning
   */
  calculateBudgetSummary(
    currentBalance: number,
    pendingClaims: PendingClaim[],
    monthlyRent: number,
    therapists: Therapist[]
  ): BudgetSummary {
    // Sum pending income from unpaid claims
    const pendingIncome = pendingClaims
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0)

    // Calculate daily expenses
    const dailyRent = Math.round(monthlyRent / ECONOMY_CONFIG.RENT_DAILY_DIVISOR)
    const dailySalaries = therapists
      .filter((t) => !t.isPlayer)
      .reduce((sum, t) => sum + t.hourlySalary * 8, 0)
    const dailyExpenses = dailyRent + dailySalaries

    // Projections
    const weeklyProjection = dailyExpenses * 7
    const monthlyProjection = dailyExpenses * 30

    // Runway (days until broke)
    const runway = dailyExpenses > 0 ? Math.floor(currentBalance / dailyExpenses) : Infinity

    return {
      currentBalance,
      pendingIncome,
      dailyExpenses,
      weeklyProjection,
      monthlyProjection,
      runway,
    }
  },

  /**
   * Get total income for a day from transactions
   */
  getDailyIncome(transactions: Transaction[], day: number): number {
    return transactions
      .filter((t) => t.day === day && t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  /**
   * Get total expenses for a day from transactions
   */
  getDailyExpenses(transactions: Transaction[], day: number): number {
    return transactions
      .filter((t) => t.day === day && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  /**
   * Get net income for a day
   */
  getDailyNet(transactions: Transaction[], day: number): number {
    return this.getDailyIncome(transactions, day) - this.getDailyExpenses(transactions, day)
  },

  /**
   * Get transactions grouped by category
   */
  getTransactionsByCategory(
    transactions: Transaction[]
  ): Record<string, { income: number; expense: number }> {
    const result: Record<string, { income: number; expense: number }> = {}

    for (const t of transactions) {
      if (!result[t.category]) {
        result[t.category] = { income: 0, expense: 0 }
      }
      if (t.type === 'income') {
        result[t.category].income += t.amount
      } else {
        result[t.category].expense += t.amount
      }
    }

    return result
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  },

  /**
   * Format currency with sign for +/-
   */
  formatCurrencyWithSign(amount: number): string {
    const formatted = this.formatCurrency(Math.abs(amount))
    if (amount > 0) return `+${formatted}`
    if (amount < 0) return `-${formatted}`
    return formatted
  },

  /**
   * Check if player can afford an expense
   */
  canAfford(currentBalance: number, cost: number): boolean {
    return currentBalance >= cost
  },

  /**
   * Get claims by status
   */
  getClaimsByStatus(
    claims: PendingClaim[],
    status: PendingClaim['status']
  ): PendingClaim[] {
    return claims.filter((c) => c.status === status)
  },

  /**
   * Get overdue claims (pending but past expected payment date)
   */
  getOverdueClaims(claims: PendingClaim[], currentDay: number): PendingClaim[] {
    return claims.filter(
      (c) =>
        c.status === 'pending' &&
        currentDay > c.scheduledPaymentDay + ECONOMY_CONFIG.CLAIM_OVERDUE_DAYS
    )
  },

  /**
   * Calculate total value of pending claims by insurer
   */
  getPendingClaimsByInsurer(
    claims: PendingClaim[]
  ): Record<InsurerId, number> {
    const result: Partial<Record<InsurerId, number>> = {}

    for (const claim of claims) {
      if (claim.status !== 'pending') continue
      result[claim.insurerId] = (result[claim.insurerId] ?? 0) + claim.amount
    }

    return result as Record<InsurerId, number>
  },

  /**
   * Get recent transactions (last N days)
   */
  getRecentTransactions(
    transactions: Transaction[],
    currentDay: number,
    dayRange: number = 7
  ): Transaction[] {
    const startDay = currentDay - dayRange
    return transactions
      .filter((t) => t.day >= startDay && t.day <= currentDay)
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
  },
}
