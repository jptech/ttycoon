import type {
  Transaction,
  Session,
  Client,
  Therapist,
  PendingClaim
} from '@/core/types'

/**
 * Summary of a single day's activity
 */
export interface DaySummary {
  day: number
  financials: {
    totalIncome: number
    totalExpenses: number
    netIncome: number
    sessionsRevenue: number
    insuranceRevenue: number
    otherIncome: number
  }
  sessions: {
    completed: number
    cancelled: number
    averageQuality: number
  }
  clients: {
    newArrivals: number
    treatmentCompleted: number
    droppedClients: number
    waitingListCount: number
  }
  therapists: {
    averageEnergy: number
    totalXpGained: number
    trainingsInProgress: number
    burnedOutCount: number
  }
  claims: {
    submitted: number
    paid: number
    denied: number
    pendingAmount: number
  }
}

/**
 * Pure functions for calculating day summaries
 */
export const DaySummaryManager = {
  /**
   * Calculate summary for a specific day
   */
  calculateDaySummary(
    day: number,
    transactions: Transaction[],
    sessions: Session[],
    clients: Client[],
    therapists: Therapist[],
    pendingClaims: PendingClaim[],
    waitingListCount: number,
    activeTrainingsCount: number
  ): DaySummary {
    // Filter transactions for this day
    const dayTransactions = transactions.filter(t => t.day === day)

    // Calculate financials
    const financials = this.calculateFinancials(dayTransactions)

    // Calculate session stats for this day
    const sessionStats = this.calculateSessionStats(sessions, day)

    // Calculate client stats
    const clientStats = this.calculateClientStats(clients, day, waitingListCount)

    // Calculate therapist stats
    const therapistStats = this.calculateTherapistStats(therapists, sessions, day, activeTrainingsCount)

    // Calculate claims stats for this day
    const claimStats = this.calculateClaimStats(pendingClaims, day)

    return {
      day,
      financials,
      sessions: sessionStats,
      clients: clientStats,
      therapists: therapistStats,
      claims: claimStats,
    }
  },

  /**
   * Calculate financial summary from transactions
   */
  calculateFinancials(transactions: Transaction[]): DaySummary['financials'] {
    let totalIncome = 0
    let totalExpenses = 0
    let sessionsRevenue = 0
    let insuranceRevenue = 0
    let otherIncome = 0

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount

        if (t.category.toLowerCase().includes('session')) {
          sessionsRevenue += t.amount
        } else if (t.category.toLowerCase().includes('insurance') || t.category.toLowerCase().includes('claim')) {
          insuranceRevenue += t.amount
        } else {
          otherIncome += t.amount
        }
      } else {
        totalExpenses += t.amount
      }
    }

    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      sessionsRevenue,
      insuranceRevenue,
      otherIncome,
    }
  },

  /**
   * Calculate session statistics for a day
   */
  calculateSessionStats(sessions: Session[], day: number): DaySummary['sessions'] {
    const daySessions = sessions.filter(s =>
      s.completedAt?.day === day || s.scheduledDay === day
    )

    const completed = daySessions.filter(s => s.status === 'completed').length
    const cancelled = daySessions.filter(s => s.status === 'cancelled').length

    const completedSessions = daySessions.filter(s => s.status === 'completed')
    const averageQuality = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.quality || 0.5), 0) / completedSessions.length
      : 0

    return {
      completed,
      cancelled,
      averageQuality: Math.round(averageQuality * 100) / 100,
    }
  },

  /**
   * Calculate client statistics
   */
  calculateClientStats(
    clients: Client[],
    day: number,
    waitingListCount: number
  ): DaySummary['clients'] {
    const newArrivals = clients.filter(c => c.arrivalDay === day).length
    const treatmentCompleted = clients.filter(c =>
      c.status === 'completed' && c.sessionsCompleted > 0
    ).length
    const droppedClients = clients.filter(c =>
      c.status === 'dropped'
    ).length

    return {
      newArrivals,
      treatmentCompleted,
      droppedClients,
      waitingListCount,
    }
  },

  /**
   * Calculate therapist statistics
   */
  calculateTherapistStats(
    therapists: Therapist[],
    sessions: Session[],
    day: number,
    activeTrainingsCount: number
  ): DaySummary['therapists'] {
    const averageEnergy = therapists.length > 0
      ? Math.round(therapists.reduce((sum, t) => sum + t.energy, 0) / therapists.length)
      : 0

    // Calculate XP gained from today's sessions
    const todaySessions = sessions.filter(s =>
      s.status === 'completed' && s.completedAt?.day === day
    )
    const totalXpGained = todaySessions.reduce((sum, s) => sum + (s.xpGained || 0), 0)

    const burnedOutCount = therapists.filter(t => t.status === 'burned_out').length

    return {
      averageEnergy,
      totalXpGained,
      trainingsInProgress: activeTrainingsCount,
      burnedOutCount,
    }
  },

  /**
   * Calculate insurance claims statistics
   */
  calculateClaimStats(claims: PendingClaim[], day: number): DaySummary['claims'] {
    // Claims scheduled to be paid today
    const submitted = claims.filter(c => c.scheduledPaymentDay === day && c.status === 'pending').length
    const paid = claims.filter(c => c.status === 'paid').length
    const denied = claims.filter(c => c.status === 'denied').length
    const pendingAmount = claims
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0)

    return {
      submitted,
      paid,
      denied,
      pendingAmount,
    }
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
   * Get a summary rating based on the day's performance
   */
  getDayRating(summary: DaySummary): 'excellent' | 'good' | 'average' | 'poor' {
    const { financials, sessions, therapists } = summary

    let score = 0

    // Financial performance
    if (financials.netIncome > 500) score += 2
    else if (financials.netIncome > 0) score += 1
    else if (financials.netIncome < -500) score -= 1

    // Session performance
    if (sessions.completed >= 5) score += 2
    else if (sessions.completed >= 3) score += 1
    if (sessions.averageQuality >= 0.8) score += 1

    // Team health
    if (therapists.averageEnergy >= 70) score += 1
    if (therapists.burnedOutCount > 0) score -= 1

    if (score >= 5) return 'excellent'
    if (score >= 3) return 'good'
    if (score >= 1) return 'average'
    return 'poor'
  },
}
