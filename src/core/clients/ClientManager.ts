import type {
  Client,
  Therapist,
  Session,
  ClientStatus,
  ConditionCategory,
  SessionFrequency,
  TimePreference,
  DayAvailability,
  InsurerId,
  Certification,
} from '@/core/types'

/**
 * Configuration for client generation and management
 */
export const CLIENT_CONFIG = {
  /** Minimum sessions required for treatment */
  MIN_SESSIONS_REQUIRED: 4,
  /** Maximum sessions required for treatment */
  MAX_SESSIONS_REQUIRED: 20,
  /** Minimum severity level */
  MIN_SEVERITY: 1,
  /** Maximum severity level */
  MAX_SEVERITY: 10,
  /** Base satisfaction for new clients */
  BASE_SATISFACTION: 70,
  /** Base engagement for new clients */
  BASE_ENGAGEMENT: 60,
  /** Default max wait days before leaving */
  DEFAULT_MAX_WAIT_DAYS: 14,
  /** Satisfaction loss per day waiting */
  WAIT_SATISFACTION_LOSS: 2,
  /** Satisfaction threshold for dropout */
  DROPOUT_THRESHOLD: 30,
  /** Engagement boost from good session */
  GOOD_SESSION_ENGAGEMENT_BOOST: 5,
  /** Satisfaction boost from good session */
  GOOD_SESSION_SATISFACTION_BOOST: 3,
  /** Progress per session (base, modified by quality) */
  BASE_PROGRESS_PER_SESSION: 0.1,
  /** Chance of private pay client (vs insurance) */
  PRIVATE_PAY_CHANCE: 0.3,
  /** Chance of preferring virtual */
  VIRTUAL_PREFERENCE_CHANCE: 0.4,
  /** Chance client is a minor */
  MINOR_CHANCE: 0.15,
  /** Chance client is a couple */
  COUPLE_CHANCE: 0.1,

  /** Max fraction of newly generated clients that require credentials/certification */
  MAX_CREDENTIAL_REQUIRED_RATE: 0.35,

  /** Days to ramp credential requirements from 0 -> max (scaled with practice level) */
  CREDENTIAL_RAMP_DAYS: 120,

  /** Max practice level used for scaling */
  MAX_PRACTICE_LEVEL: 5,
} as const

export interface ClientGenerationOptions {
  /** Practice level (1-5) used for progressive credential requirements */
  practiceLevel?: number
  /** Force all generated clients to have no credential requirements */
  forceNoCredentials?: boolean
  /** Override max credential requirement rate (0-1). Useful for tests. */
  maxCredentialRequiredRate?: number
  /** Override RNG (useful for deterministic tests) */
  random?: () => number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Progressive chance that a newly generated client requires credentials.
 * - Starts at 0% at Day 1 / Practice Level 1.
 * - Ramps toward MAX_CREDENTIAL_REQUIRED_RATE as practice level increases and time passes.
 */
export function getCredentialRequirementChance(
  currentDay: number,
  practiceLevel: number,
  maxRate: number = CLIENT_CONFIG.MAX_CREDENTIAL_REQUIRED_RATE
): number {
  const levelProgress = clamp01(
    (practiceLevel - 1) / Math.max(1, CLIENT_CONFIG.MAX_PRACTICE_LEVEL - 1)
  )
  const dayProgress = clamp01((currentDay - 1) / CLIENT_CONFIG.CREDENTIAL_RAMP_DAYS)

  // Weight level slightly more than time.
  const combinedProgress = clamp01(levelProgress * 0.6 + dayProgress * 0.4)
  return combinedProgress * clamp01(maxRate)
}

/**
 * Client match score result
 */
export interface ClientMatchScore {
  clientId: string
  therapistId: string
  score: number
  breakdown: {
    certificationMatch: number
    specializationMatch: number
    availabilityMatch: number
    traitMatch: number
  }
}

/**
 * Result of generating a new client
 */
export interface ClientGenerationResult {
  client: Client
  reason: string
}

/**
 * Result of processing waiting list
 */
export interface WaitingListResult {
  remainingClients: Client[]
  droppedClients: Client[]
  satisfactionChanges: Array<{ clientId: string; oldSatisfaction: number; newSatisfaction: number }>
}

/**
 * Result of updating client after session
 */
export interface SessionOutcomeResult {
  updatedClient: Client
  progressMade: number
  treatmentCompleted: boolean
  satisfactionChange: number
  engagementChange: number
}

/**
 * Follow-up scheduling info for a client
 */
export interface FollowUpInfo {
  /** Client's last completed session */
  lastSession: Session | null
  /** Day the last session was completed */
  lastSessionDay: number | null
  /** Day when next session is due based on frequency */
  nextDueDay: number | null
  /** Days until next session is due (negative = overdue) */
  daysUntilDue: number | null
  /** Whether the client is overdue for a session */
  isOverdue: boolean
  /** Whether client has any upcoming scheduled session */
  hasUpcomingSession: boolean
  /** Next scheduled session (if any) */
  nextScheduledSession: Session | null
  /** Remaining sessions needed */
  remainingSessions: number
}

export interface ClientUpcomingSessionsSummary {
  /** Scheduled sessions at or after the current time */
  upcomingScheduled: Session[]
  /** Sessions currently in progress for this client */
  inProgress: Session[]
  /** Remaining sessions needed (sessionsRequired - sessionsCompleted) */
  remainingNeeded: number
  /** Count of upcoming scheduled sessions */
  scheduledCount: number
  /** Count of in-progress sessions */
  inProgressCount: number
  /** Remaining sessions not yet scheduled (clamped to >= 0) */
  unscheduledRemaining: number
}

/**
 * Days between sessions for each frequency
 */
export const FREQUENCY_DAYS: Record<SessionFrequency, number> = {
  once: 0, // No follow-up
  weekly: 7,
  biweekly: 14,
  monthly: 30,
}

/**
 * Condition types by category
 */
export const CONDITION_TYPES: Record<ConditionCategory, string[]> = {
  anxiety: ['Generalized Anxiety', 'Social Anxiety', 'Panic Disorder', 'Phobias', 'Health Anxiety'],
  depression: ['Major Depression', 'Persistent Depressive Disorder', 'Seasonal Affective Disorder', 'Postpartum Depression'],
  trauma: ['PTSD', 'Complex PTSD', 'Acute Stress Disorder', 'Childhood Trauma'],
  stress: ['Work Stress', 'Burnout', 'Life Transitions', 'Caregiver Stress'],
  relationship: ['Couples Issues', 'Family Conflict', 'Communication Problems', 'Divorce/Separation'],
  behavioral: ['Anger Management', 'Impulse Control', 'Addiction Recovery', 'Eating Disorders'],
}

/**
 * Required certifications by condition category
 */
export const CERTIFICATION_REQUIREMENTS: Partial<Record<ConditionCategory, Certification>> = {
  trauma: 'trauma_certified',
  relationship: 'couples_certified',
}

/**
 * Pure client management functions
 */
export const ClientManager = {
  /**
   * Generate a new client with random attributes
   */
  generateClient(
    currentDay: number,
    availableInsurers: InsurerId[],
    sessionRate: number,
    seed?: number,
    options?: ClientGenerationOptions
  ): ClientGenerationResult {
    const random = options?.random ?? (seed !== undefined ? seededRandom(seed) : Math.random)

    const practiceLevel = options?.practiceLevel ?? 1
    const maxRate = options?.maxCredentialRequiredRate ?? CLIENT_CONFIG.MAX_CREDENTIAL_REQUIRED_RATE
    const credentialChance = options?.forceNoCredentials
      ? 0
      : getCredentialRequirementChance(currentDay, practiceLevel, maxRate)

    // Decide early so tests can deterministically control this with a simple RNG.
    const requiresCredentials = !options?.forceNoCredentials && random() < credentialChance

    // Generate ID and name
    const id = crypto.randomUUID()
    const displayName = generateClientName(random)

    // Determine condition
    const conditionCategory = pickRandom(Object.keys(CONDITION_TYPES) as ConditionCategory[], random)
    const conditionType = pickRandom(CONDITION_TYPES[conditionCategory], random)
    const severity = randomInt(CLIENT_CONFIG.MIN_SEVERITY, CLIENT_CONFIG.MAX_SEVERITY, random)

    // Sessions required based on severity
    const sessionsRequired = Math.max(
      CLIENT_CONFIG.MIN_SESSIONS_REQUIRED,
      Math.min(
        CLIENT_CONFIG.MAX_SESSIONS_REQUIRED,
        Math.round(severity * 1.5 + randomInt(2, 6, random))
      )
    )

    // Financial setup
    const isPrivatePay = random() < CLIENT_CONFIG.PRIVATE_PAY_CHANCE || availableInsurers.length === 0
    const insuranceProvider = isPrivatePay ? null : pickRandom(availableInsurers, random)

    // Preferences
    const prefersVirtual = random() < CLIENT_CONFIG.VIRTUAL_PREFERENCE_CHANCE
    const preferredFrequency = pickRandom<SessionFrequency>(['weekly', 'biweekly', 'weekly', 'weekly'], random)
    const preferredTime = pickRandom<TimePreference>(['morning', 'afternoon', 'evening', 'any'], random)
    const availability = generateAvailability(preferredTime, random)

    // Special requirements (credentials)
    let isMinor = false
    let isCouple = false
    let requiredCertification: Certification | null = null

    if (requiresCredentials) {
      isMinor = random() < CLIENT_CONFIG.MINOR_CHANCE
      isCouple = !isMinor && conditionCategory === 'relationship' && random() < CLIENT_CONFIG.COUPLE_CHANCE
      requiredCertification = getRequiredCertification(conditionCategory, isMinor, isCouple, random, true)
    }

    // Max wait based on severity (higher severity = less patience)
    const maxWaitDays = Math.max(7, CLIENT_CONFIG.DEFAULT_MAX_WAIT_DAYS - Math.floor(severity / 2))

    const client: Client = {
      id,
      displayName,
      conditionCategory,
      conditionType,
      severity,
      sessionsRequired,
      sessionsCompleted: 0,
      treatmentProgress: 0,
      status: 'waiting',
      satisfaction: CLIENT_CONFIG.BASE_SATISFACTION,
      engagement: CLIENT_CONFIG.BASE_ENGAGEMENT,
      isPrivatePay,
      insuranceProvider,
      sessionRate,
      prefersVirtual,
      preferredFrequency,
      preferredTime,
      availability,
      requiredCertification,
      isMinor,
      isCouple,
      arrivalDay: currentDay,
      daysWaiting: 0,
      maxWaitDays,
      assignedTherapistId: null,
    }

    return {
      client,
      reason: `New client seeking help with ${conditionType}`,
    }
  },

  /**
   * Calculate match score between client and therapist
   */
  calculateMatchScore(client: Client, therapist: Therapist): ClientMatchScore {
    let certificationMatch = 100
    let specializationMatch = 0
    const availabilityMatch = 50 // Base availability
    let traitMatch = 50

    // Check certification requirement
    if (client.requiredCertification) {
      certificationMatch = therapist.certifications.includes(client.requiredCertification) ? 100 : 0
    }
    if (client.isMinor && !therapist.certifications.includes('children_certified')) {
      certificationMatch = 0
    }
    if (client.isCouple && !therapist.certifications.includes('couples_certified')) {
      certificationMatch = 0
    }

    // Check specialization match
    const relevantSpecs = getRelevantSpecializations(client.conditionCategory)
    const matchingSpecs = therapist.specializations.filter((s) => relevantSpecs.includes(s))
    specializationMatch = matchingSpecs.length > 0 ? Math.min(100, matchingSpecs.length * 40) : 20

    // Trait matching (simplified - warmth helps everyone, analytical helps anxiety/depression)
    const warmthBonus = therapist.traits.warmth * 5
    const analyticalBonus =
      client.conditionCategory === 'anxiety' || client.conditionCategory === 'depression'
        ? therapist.traits.analytical * 3
        : 0
    const creativityBonus =
      client.conditionCategory === 'behavioral' || client.conditionCategory === 'relationship'
        ? therapist.traits.creativity * 3
        : 0
    traitMatch = Math.min(100, 20 + warmthBonus + analyticalBonus + creativityBonus)

    // Calculate total score (certification is weighted heavily as it's often a requirement)
    const score = Math.round(
      certificationMatch * 0.4 + specializationMatch * 0.25 + availabilityMatch * 0.15 + traitMatch * 0.2
    )

    return {
      clientId: client.id,
      therapistId: therapist.id,
      score,
      breakdown: {
        certificationMatch,
        specializationMatch,
        availabilityMatch,
        traitMatch,
      },
    }
  },

  /**
   * Find best therapist match for a client
   */
  findBestMatch(client: Client, therapists: Therapist[]): ClientMatchScore | null {
    const availableTherapists = therapists.filter((t) => t.status === 'available' || t.status === 'on_break')
    if (availableTherapists.length === 0) return null

    const scores = availableTherapists.map((t) => this.calculateMatchScore(client, t))
    const validScores = scores.filter((s) => s.breakdown.certificationMatch > 0)

    if (validScores.length === 0) return null

    return validScores.reduce((best, current) => (current.score > best.score ? current : best))
  },

  /**
   * CRIT-006 fix: Check if therapist can serve this client
   * Returns validation result with reason if invalid
   */
  canTherapistServeClient(
    client: Client,
    therapist: Therapist
  ): { valid: boolean; reason?: string } {
    // Check minor certification
    if (client.isMinor && !therapist.certifications.includes('children_certified')) {
      return { valid: false, reason: 'Client is a minor and therapist lacks children certification' }
    }

    // Check couple certification
    if (client.isCouple && !therapist.certifications.includes('couples_certified')) {
      return { valid: false, reason: 'Client is a couple and therapist lacks couples certification' }
    }

    // Check required certification
    if (client.requiredCertification && !therapist.certifications.includes(client.requiredCertification)) {
      return {
        valid: false,
        reason: `Client requires ${client.requiredCertification} certification which therapist lacks`,
      }
    }

    return { valid: true }
  },

  /**
   * Assign client to therapist
   * CRIT-006 fix: Now validates therapist qualifications
   * @throws Error if therapist cannot serve this client
   */
  assignClient(client: Client, therapist: Therapist): Client {
    // CRIT-006 fix: Validate therapist can serve this client
    const validation = this.canTherapistServeClient(client, therapist)
    if (!validation.valid) {
      throw new Error(`Cannot assign client: ${validation.reason}`)
    }

    return {
      ...client,
      assignedTherapistId: therapist.id,
      status: 'in_treatment',
      daysWaiting: client.daysWaiting,
    }
  },

  /**
   * Process waiting list - update satisfaction and handle dropouts
   */
  processWaitingList(clients: Client[], currentDay: number): WaitingListResult {
    const remainingClients: Client[] = []
    const droppedClients: Client[] = []
    const satisfactionChanges: Array<{ clientId: string; oldSatisfaction: number; newSatisfaction: number }> = []

    for (const client of clients) {
      if (client.status !== 'waiting') {
        remainingClients.push(client)
        continue
      }

      const daysWaiting = currentDay - client.arrivalDay
      const oldSatisfaction = client.satisfaction
      const newSatisfaction = Math.max(0, oldSatisfaction - CLIENT_CONFIG.WAIT_SATISFACTION_LOSS)

      if (daysWaiting >= client.maxWaitDays || newSatisfaction <= CLIENT_CONFIG.DROPOUT_THRESHOLD) {
        // Client drops out
        droppedClients.push({
          ...client,
          status: 'dropped',
          satisfaction: newSatisfaction,
          daysWaiting,
        })
      } else {
        // Client remains waiting
        remainingClients.push({
          ...client,
          satisfaction: newSatisfaction,
          daysWaiting,
        })
        satisfactionChanges.push({ clientId: client.id, oldSatisfaction, newSatisfaction })
      }
    }

    return { remainingClients, droppedClients, satisfactionChanges }
  },

  /**
   * Update client after completing a session
   */
  processSessionOutcome(
    client: Client,
    sessionQuality: number // 0-1
  ): SessionOutcomeResult {
    const qualityMultiplier = 0.5 + sessionQuality // 0.5-1.5
    const progressMade = CLIENT_CONFIG.BASE_PROGRESS_PER_SESSION * qualityMultiplier

    const newProgress = Math.min(1, client.treatmentProgress + progressMade)
    const sessionsCompleted = client.sessionsCompleted + 1

    // Satisfaction and engagement changes based on quality
    const satisfactionChange =
      sessionQuality >= 0.7
        ? CLIENT_CONFIG.GOOD_SESSION_SATISFACTION_BOOST
        : sessionQuality < 0.4
          ? -5
          : 0
    const engagementChange =
      sessionQuality >= 0.7
        ? CLIENT_CONFIG.GOOD_SESSION_ENGAGEMENT_BOOST
        : sessionQuality < 0.4
          ? -3
          : 1

    const newSatisfaction = Math.max(0, Math.min(100, client.satisfaction + satisfactionChange))
    const newEngagement = Math.max(0, Math.min(100, client.engagement + engagementChange))

    // Check if treatment is complete
    const treatmentCompleted = sessionsCompleted >= client.sessionsRequired || newProgress >= 1

    const updatedClient: Client = {
      ...client,
      sessionsCompleted,
      treatmentProgress: newProgress,
      satisfaction: newSatisfaction,
      engagement: newEngagement,
      status: treatmentCompleted ? 'completed' : client.status,
    }

    return {
      updatedClient,
      progressMade,
      treatmentCompleted,
      satisfactionChange,
      engagementChange,
    }
  },

  /**
   * Check if a client might drop out (low satisfaction/engagement)
   */
  checkDropoutRisk(client: Client): { atRisk: boolean; riskLevel: 'low' | 'medium' | 'high'; reason: string } {
    if (client.satisfaction < 40 && client.engagement < 40) {
      return { atRisk: true, riskLevel: 'high', reason: 'Very low satisfaction and engagement' }
    }
    if (client.satisfaction < 50) {
      return { atRisk: true, riskLevel: 'medium', reason: 'Low satisfaction' }
    }
    if (client.engagement < 50) {
      return { atRisk: true, riskLevel: 'medium', reason: 'Low engagement' }
    }
    if (client.satisfaction < 60 || client.engagement < 60) {
      return { atRisk: true, riskLevel: 'low', reason: 'Below average satisfaction or engagement' }
    }
    return { atRisk: false, riskLevel: 'low', reason: '' }
  },

  /**
   * Handle client dropout
   */
  processDropout(client: Client): Client {
    return {
      ...client,
      status: 'dropped',
    }
  },

  /**
   * Get clients by status
   */
  getClientsByStatus(clients: Client[], status: ClientStatus): Client[] {
    return clients.filter((c) => c.status === status)
  },

  /**
   * Get waiting clients sorted by priority (longest wait + highest severity first)
   */
  getWaitingClientsPrioritized(clients: Client[]): Client[] {
    return clients
      .filter((c) => c.status === 'waiting')
      .sort((a, b) => {
        // Priority score: days waiting + severity
        const priorityA = a.daysWaiting * 2 + a.severity
        const priorityB = b.daysWaiting * 2 + b.severity
        return priorityB - priorityA
      })
  },

  /**
   * Get clients assigned to a specific therapist
   */
  getTherapistClients(clients: Client[], therapistId: string): Client[] {
    return clients.filter((c) => c.assignedTherapistId === therapistId && c.status === 'in_treatment')
  },

  /**
   * Get client statistics
   */
  getClientStats(clients: Client[]): {
    waiting: number
    inTreatment: number
    completed: number
    dropped: number
    avgSatisfaction: number
    avgProgress: number
  } {
    const waiting = clients.filter((c) => c.status === 'waiting').length
    const inTreatment = clients.filter((c) => c.status === 'in_treatment').length
    const completed = clients.filter((c) => c.status === 'completed').length
    const dropped = clients.filter((c) => c.status === 'dropped').length

    const activeClients = clients.filter((c) => c.status === 'waiting' || c.status === 'in_treatment')
    const avgSatisfaction =
      activeClients.length > 0
        ? Math.round(activeClients.reduce((sum, c) => sum + c.satisfaction, 0) / activeClients.length)
        : 0

    const treatmentClients = clients.filter((c) => c.status === 'in_treatment')
    const avgProgress =
      treatmentClients.length > 0
        ? Math.round((treatmentClients.reduce((sum, c) => sum + c.treatmentProgress, 0) / treatmentClients.length) * 100)
        : 0

    return { waiting, inTreatment, completed, dropped, avgSatisfaction, avgProgress }
  },

  /**
   * Calculate expected revenue from active clients
   */
  calculateExpectedRevenue(clients: Client[]): number {
    const activeClients = clients.filter((c) => c.status === 'in_treatment')
    return activeClients.reduce((sum, c) => {
      const remainingSessions = c.sessionsRequired - c.sessionsCompleted
      return sum + remainingSessions * c.sessionRate
    }, 0)
  },

  /**
   * Get clients at risk of dropping out
   */
  getAtRiskClients(clients: Client[]): Client[] {
    return clients.filter((c) => {
      if (c.status !== 'in_treatment' && c.status !== 'waiting') return false
      return this.checkDropoutRisk(c).atRisk
    })
  },

  /**
   * Format client summary for display
   */
  formatClientSummary(client: Client): string {
    return `${client.displayName} - ${client.conditionType} (Severity: ${client.severity}/10)`
  },

  /**
   * Get a client's last completed session
   */
  getLastCompletedSession(client: Client, sessions: Session[]): Session | null {
    const clientSessions = sessions
      .filter((s) => s.clientId === client.id && s.status === 'completed' && s.completedAt)
      .sort((a, b) => {
        if (!a.completedAt || !b.completedAt) return 0
        return b.completedAt.day - a.completedAt.day
      })

    return clientSessions[0] ?? null
  },

  /**
   * Get a client's next scheduled session
   */
  getNextScheduledSession(client: Client, sessions: Session[], currentDay: number): Session | null {
    const upcomingSessions = sessions
      .filter(
        (s) =>
          s.clientId === client.id &&
          s.status === 'scheduled' &&
          s.scheduledDay >= currentDay
      )
      .sort((a, b) => a.scheduledDay - b.scheduledDay || a.scheduledHour - b.scheduledHour)

    return upcomingSessions[0] ?? null
  },

  /**
   * Get upcoming sessions for a client.
   * - Includes `scheduled` sessions at or after the current time.
   * - Includes all `in_progress` sessions (treated as upcoming for UI summary).
   */
  getUpcomingSessionsForClient(
    clientId: string,
    sessions: Session[],
    currentTime: { day: number; hour: number; minute: number }
  ): { upcomingScheduled: Session[]; inProgress: Session[] } {
    const inProgress = sessions
      .filter((s) => s.clientId === clientId && s.status === 'in_progress')
      .sort((a, b) => a.scheduledDay - b.scheduledDay || a.scheduledHour - b.scheduledHour)

    const upcomingScheduled = sessions
      .filter((s) => {
        if (s.clientId !== clientId) return false
        if (s.status !== 'scheduled') return false

        if (s.scheduledDay > currentTime.day) return true
        if (s.scheduledDay < currentTime.day) return false

        // Same day: sessions start on the hour.
        if (s.scheduledHour > currentTime.hour) return true
        if (s.scheduledHour < currentTime.hour) return false
        return currentTime.minute === 0
      })
      .sort((a, b) => a.scheduledDay - b.scheduledDay || a.scheduledHour - b.scheduledHour)

    return { upcomingScheduled, inProgress }
  },

  /**
   * Compute a compact summary for UI about what is scheduled vs remaining.
   */
  getUpcomingSessionsSummary(
    client: Client,
    sessions: Session[],
    currentTime: { day: number; hour: number; minute: number }
  ): ClientUpcomingSessionsSummary {
    const remainingNeeded = client.sessionsRequired - client.sessionsCompleted
    const { upcomingScheduled, inProgress } = this.getUpcomingSessionsForClient(
      client.id,
      sessions,
      currentTime
    )

    const scheduledCount = upcomingScheduled.length
    const inProgressCount = inProgress.length
    const unscheduledRemaining = Math.max(0, remainingNeeded - scheduledCount - inProgressCount)

    return {
      upcomingScheduled,
      inProgress,
      remainingNeeded,
      scheduledCount,
      inProgressCount,
      unscheduledRemaining,
    }
  },

  /**
   * Calculate follow-up scheduling info for a client
   */
  getFollowUpInfo(client: Client, sessions: Session[], currentDay: number): FollowUpInfo {
    const lastSession = this.getLastCompletedSession(client, sessions)
    const nextScheduledSession = this.getNextScheduledSession(client, sessions, currentDay)
    const remainingSessions = client.sessionsRequired - client.sessionsCompleted

    // For clients with no completed sessions yet
    if (!lastSession || !lastSession.completedAt) {
      return {
        lastSession: null,
        lastSessionDay: null,
        nextDueDay: null,
        daysUntilDue: null,
        isOverdue: false,
        hasUpcomingSession: nextScheduledSession !== null,
        nextScheduledSession,
        remainingSessions,
      }
    }

    const lastSessionDay = lastSession.completedAt.day
    const frequencyDays = FREQUENCY_DAYS[client.preferredFrequency]

    // For one-time sessions or completed treatment
    if (frequencyDays === 0 || remainingSessions <= 0) {
      return {
        lastSession,
        lastSessionDay,
        nextDueDay: null,
        daysUntilDue: null,
        isOverdue: false,
        hasUpcomingSession: nextScheduledSession !== null,
        nextScheduledSession,
        remainingSessions,
      }
    }

    const nextDueDay = lastSessionDay + frequencyDays
    const daysUntilDue = nextDueDay - currentDay
    const isOverdue = daysUntilDue < 0 && !nextScheduledSession

    return {
      lastSession,
      lastSessionDay,
      nextDueDay,
      daysUntilDue,
      isOverdue,
      hasUpcomingSession: nextScheduledSession !== null,
      nextScheduledSession,
      remainingSessions,
    }
  },

  /**
   * Get active clients sorted by follow-up urgency
   */
  getActiveClientsByFollowUpUrgency(
    clients: Client[],
    sessions: Session[],
    currentDay: number
  ): Array<{ client: Client; followUp: FollowUpInfo }> {
    return clients
      .filter((c) => c.status === 'in_treatment')
      .map((client) => ({
        client,
        followUp: this.getFollowUpInfo(client, sessions, currentDay),
      }))
      .sort((a, b) => {
        // Overdue clients first
        if (a.followUp.isOverdue && !b.followUp.isOverdue) return -1
        if (!a.followUp.isOverdue && b.followUp.isOverdue) return 1

        // Then by days until due (ascending, so sooner comes first)
        if (a.followUp.daysUntilDue !== null && b.followUp.daysUntilDue !== null) {
          return a.followUp.daysUntilDue - b.followUp.daysUntilDue
        }

        // Clients with follow-up info before those without
        if (a.followUp.daysUntilDue !== null) return -1
        if (b.followUp.daysUntilDue !== null) return 1

        return 0
      })
  },
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Simple seeded random for deterministic generation
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Pick random element from array
 */
function pickRandom<T>(arr: T[], random: () => number = Math.random): T {
  return arr[Math.floor(random() * arr.length)]
}

/**
 * Generate random integer in range
 */
function randomInt(min: number, max: number, random: () => number = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min
}

/**
 * Generate anonymized client name (e.g., "Client AB")
 */
function generateClientName(random: () => number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const first = letters[Math.floor(random() * letters.length)]
  const second = letters[Math.floor(random() * letters.length)]
  return `Client ${first}${second}`
}

/**
 * Generate availability based on time preference
 */
function generateAvailability(preference: TimePreference, random: () => number): DayAvailability {
  const morningHours = [9, 10, 11]
  const afternoonHours = [13, 14, 15, 16]
  const eveningHours = [17, 18, 19]

  const getHoursForPreference = (): number[] => {
    switch (preference) {
      case 'morning':
        return morningHours
      case 'afternoon':
        return afternoonHours
      case 'evening':
        return eveningHours
      case 'any':
        return [...morningHours, ...afternoonHours, ...eveningHours]
    }
  }

  const baseHours = getHoursForPreference()

  // Randomly exclude some days
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  const availability: DayAvailability = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  }

  for (const day of days) {
    // 80% chance of being available on any given day
    if (random() < 0.8) {
      availability[day] = [...baseHours]
    }
  }

  // Ensure at least one day is available
  if (Object.values(availability).every((hours) => hours.length === 0)) {
    availability.monday = [...baseHours]
  }

  return availability
}

/**
 * Get required certification for condition
 */
function getRequiredCertification(
  category: ConditionCategory,
  isMinor: boolean,
  isCouple: boolean,
  random: () => number,
  ensureNonNull: boolean
): Certification | null {
  if (isMinor) return 'children_certified'
  if (isCouple) return 'couples_certified'

  const mapped = CERTIFICATION_REQUIREMENTS[category] ?? null
  if (mapped) return mapped

  if (!ensureNonNull) return null

  // Fallback requirements so the "credentials required" fraction is meaningful
  // even for categories without a dedicated certification mapping.
  const fallbackCerts: Certification[] = [
    'cbt_certified',
    'dbt_certified',
    'emdr_certified',
    'substance_certified',
  ]

  return pickRandom(fallbackCerts, random)
}

/**
 * Get specializations relevant to condition category
 */
function getRelevantSpecializations(category: ConditionCategory): string[] {
  const mapping: Record<ConditionCategory, string[]> = {
    anxiety: ['anxiety_disorders', 'stress_management', 'ocd'],
    depression: ['depression', 'grief'],
    trauma: ['trauma', 'ptsd'],
    stress: ['stress_management'],
    relationship: ['couples'],
    behavioral: ['substance_abuse', 'eating_disorders', 'personality_disorders'],
  }
  return mapping[category] ?? []
}
