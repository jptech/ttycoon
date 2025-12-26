import type {
  Session,
  Therapist,
  Client,
  GameTime,
  QualityModifier,
  DecisionEvent,
  DecisionChoice,
} from '@/core/types'

/**
 * Configuration for session management
 */
export const SESSION_CONFIG = {
  /** Base XP per session */
  BASE_XP: 10,
  /** XP multiplier for high quality sessions */
  HIGH_QUALITY_XP_MULTIPLIER: 1.5,
  /** Quality threshold for "high quality" */
  HIGH_QUALITY_THRESHOLD: 0.75,
  /** Base satisfaction change per session */
  BASE_SATISFACTION_CHANGE: 5,
  /** Base engagement change per session */
  BASE_ENGAGEMENT_CHANGE: 3,
  /** Treatment progress per quality point */
  PROGRESS_PER_QUALITY: 0.1,
  /** Chance of a decision event per session (0-1) */
  DECISION_EVENT_CHANCE: 0.4,
  /** Minimum progress before first decision event can trigger */
  MIN_PROGRESS_FOR_EVENT: 0.2,

  // Non-linear treatment progress configuration
  /** Quality threshold for breakthrough chance (>=90% quality) */
  BREAKTHROUGH_QUALITY_THRESHOLD: 0.9,
  /** Chance of breakthrough when quality meets threshold (20%) */
  BREAKTHROUGH_CHANCE: 0.2,
  /** Progress multiplier during breakthrough (2x) */
  BREAKTHROUGH_MULTIPLIER: 2.0,

  /** Chance of plateau when satisfaction is low (<50%) */
  PLATEAU_CHANCE: 0.15,
  /** Plateau reduces progress to this fraction (25%) */
  PLATEAU_MULTIPLIER: 0.25,
  /** Satisfaction threshold below which plateau can occur */
  PLATEAU_SATISFACTION_THRESHOLD: 50,

  /** Regression from crisis decisions (subtract from progress) */
  REGRESSION_AMOUNT: 0.02,
} as const

/**
 * Result of starting a session
 */
export interface SessionStartResult {
  session: Session
  therapist: Therapist
  client: Client
}

/**
 * Result of progressing a session
 */
export interface SessionProgressResult {
  session: Session
  progressDelta: number
  decisionEvent?: DecisionEvent
}

/**
 * Result of completing a session
 */
export interface SessionCompleteResult {
  session: Session
  therapist: Therapist
  client: Client
  xpGained: number
  leveledUp: boolean
  newLevel: number
  satisfactionChange: number
  treatmentProgressGained: number
  progressType: 'normal' | 'breakthrough' | 'plateau' | 'regression'
  progressDescription: string
  paymentAmount: number
}

/**
 * Result of treatment progress calculation with non-linear effects
 */
export interface TreatmentProgressResult {
  /** Final progress gained (after modifiers) */
  progressGained: number
  /** Type of progress event that occurred */
  progressType: 'normal' | 'breakthrough' | 'plateau' | 'regression'
  /** Description of what happened */
  description: string
}

/**
 * Pure session management functions
 */
export const SessionManager = {
  /**
   * Check if a session should start based on current time
   */
  shouldStartSession(session: Session, currentTime: GameTime): boolean {
    return (
      session.status === 'scheduled' &&
      session.scheduledDay === currentTime.day &&
      session.scheduledHour === currentTime.hour &&
      currentTime.minute === 0
    )
  },

  /**
   * Start a session - transition from scheduled to in_progress
   */
  startSession(
    session: Session,
    therapist: Therapist,
    client: Client
  ): SessionStartResult {
    // Calculate initial quality modifiers
    const qualityModifiers = this.calculateInitialQualityModifiers(therapist, client, session)
    const baseQuality = this.calculateBaseQuality(qualityModifiers)

    const updatedSession: Session = {
      ...session,
      status: 'in_progress',
      progress: 0,
      quality: baseQuality,
      qualityModifiers,
    }

    const updatedTherapist: Therapist = {
      ...therapist,
      status: 'in_session',
    }

    const updatedClient: Client = {
      ...client,
      status: 'in_treatment',
    }

    return {
      session: updatedSession,
      therapist: updatedTherapist,
      client: updatedClient,
    }
  },

  /**
   * Calculate initial quality modifiers for a session
   */
  calculateInitialQualityModifiers(
    therapist: Therapist,
    client: Client,
    session: Session
  ): QualityModifier[] {
    const modifiers: QualityModifier[] = []

    // Therapist skill contribution (0-0.3 based on skill 1-100)
    const skillBonus = (therapist.baseSkill / 100) * 0.3
    modifiers.push({
      source: 'therapist_skill',
      value: skillBonus,
      description: `Therapist skill (${therapist.baseSkill})`,
    })

    // Therapist energy contribution (-0.1 to 0.1)
    const energyPercent = therapist.energy / therapist.maxEnergy
    const energyBonus = (energyPercent - 0.5) * 0.2
    modifiers.push({
      source: 'therapist_energy',
      value: energyBonus,
      description: energyPercent >= 0.5 ? 'Well-rested therapist' : 'Tired therapist',
    })

    // Client engagement contribution (0-0.15)
    const engagementBonus = (client.engagement / 100) * 0.15
    modifiers.push({
      source: 'client_engagement',
      value: engagementBonus,
      description: `Client engagement (${client.engagement}%)`,
    })

    // Specialization match bonus (0.1)
    const hasMatchingSpec = therapist.specializations.some(
      (spec) => this.specializationMatchesCondition(spec, client.conditionCategory)
    )
    if (hasMatchingSpec) {
      modifiers.push({
        source: 'specialization_match',
        value: 0.1,
        description: 'Therapist specialization matches condition',
      })
    }

    // Required certification bonus (0.05)
    if (
      client.requiredCertification &&
      therapist.certifications.includes(client.requiredCertification)
    ) {
      modifiers.push({
        source: 'certification_match',
        value: 0.05,
        description: 'Required certification held',
      })
    }

    // Virtual session penalty if client doesn't prefer it (-0.05)
    if (session.isVirtual && !client.prefersVirtual) {
      modifiers.push({
        source: 'virtual_mismatch',
        value: -0.05,
        description: 'Client prefers in-person sessions',
      })
    }

    // Severity difficulty (-0.05 to -0.15 for high severity)
    if (client.severity >= 7) {
      const severityPenalty = -0.05 * ((client.severity - 6) / 4)
      modifiers.push({
        source: 'high_severity',
        value: severityPenalty,
        description: `High severity case (${client.severity}/10)`,
      })
    }

    return modifiers
  },

  /**
   * Check if a specialization matches a condition category
   */
  specializationMatchesCondition(
    specialization: Therapist['specializations'][number],
    conditionCategory: Client['conditionCategory']
  ): boolean {
    const matches: Record<string, string[]> = {
      anxiety: ['anxiety_disorders', 'stress_management'],
      depression: ['depression', 'grief'],
      trauma: ['trauma', 'ptsd'],
      stress: ['stress_management'],
      relationship: ['couples'],
      behavioral: ['substance_abuse', 'eating_disorders', 'ocd'],
    }
    return matches[conditionCategory]?.includes(specialization) ?? false
  },

  /**
   * Calculate base quality from modifiers
   */
  calculateBaseQuality(modifiers: QualityModifier[]): number {
    const baseQuality = 0.5 // Start at 50%
    const totalModifier = modifiers.reduce((sum, m) => sum + m.value, 0)
    return Math.max(0, Math.min(1, baseQuality + totalModifier))
  },

  /**
   * Calculate treatment progress with non-linear effects.
   * Can result in breakthroughs (2x progress), plateaus (minimal progress),
   * or regression (negative progress from crisis decisions).
   */
  calculateTreatmentProgress(
    quality: number,
    clientSatisfaction: number,
    hadCrisisDecision: boolean,
    seed?: number
  ): TreatmentProgressResult {
    // Use seeded random if provided, otherwise use Math.random
    // Capture seed in local variable for closure (TypeScript narrowing)
    let seedState = seed ?? 0
    const random = seed !== undefined
      ? () => {
          // Simple seeded random (mulberry32)
          let t = (seedState += 0x6d2b79f5)
          t = Math.imul(t ^ (t >>> 15), t | 1)
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      : Math.random

    // Base progress calculation
    const baseProgress = SESSION_CONFIG.PROGRESS_PER_QUALITY * quality

    // Check for regression (crisis decisions can cause setbacks)
    if (hadCrisisDecision && random() < 0.3) {
      const progressWithRegression = Math.max(0, baseProgress - SESSION_CONFIG.REGRESSION_AMOUNT)
      return {
        progressGained: progressWithRegression,
        progressType: 'regression',
        description: 'Processing difficult material caused a temporary setback',
      }
    }

    // Check for breakthrough (high quality sessions can accelerate progress)
    if (quality >= SESSION_CONFIG.BREAKTHROUGH_QUALITY_THRESHOLD && random() < SESSION_CONFIG.BREAKTHROUGH_CHANCE) {
      return {
        progressGained: baseProgress * SESSION_CONFIG.BREAKTHROUGH_MULTIPLIER,
        progressType: 'breakthrough',
        description: 'A major breakthrough! Client made exceptional progress',
      }
    }

    // Check for plateau (low satisfaction can stall progress)
    if (clientSatisfaction < SESSION_CONFIG.PLATEAU_SATISFACTION_THRESHOLD && random() < SESSION_CONFIG.PLATEAU_CHANCE) {
      return {
        progressGained: baseProgress * SESSION_CONFIG.PLATEAU_MULTIPLIER,
        progressType: 'plateau',
        description: 'Client is struggling to engage - progress has plateaued',
      }
    }

    // Normal progress
    return {
      progressGained: baseProgress,
      progressType: 'normal',
      description: 'Steady progress in treatment',
    }
  },

  /**
   * Progress a session by a time delta
   * Note: In production, session progression happens in App.tsx with EventManager.
   * This method is used for testing and provides consistent behavior.
   */
  progressSession(
    session: Session,
    deltaMinutes: number,
    decisionEvents: DecisionEvent[],
    clientContext?: { severity: number; conditionCategory: Client['conditionCategory'] }
  ): SessionProgressResult {
    if (session.status !== 'in_progress') {
      return { session, progressDelta: 0 }
    }

    const progressDelta = deltaMinutes / session.durationMinutes
    const newProgress = Math.min(1, session.progress + progressDelta)

    const updatedSession: Session = {
      ...session,
      progress: newProgress,
    }

    // Check for decision event trigger
    let decisionEvent: DecisionEvent | undefined
    if (
      session.progress >= SESSION_CONFIG.MIN_PROGRESS_FOR_EVENT &&
      session.decisionsMade.length === 0 &&
      Math.random() < SESSION_CONFIG.DECISION_EVENT_CHANCE * progressDelta * 10
    ) {
      // Apply trigger condition filtering if client context provided
      if (clientContext) {
        decisionEvent = this.selectDecisionEvent(
          decisionEvents,
          clientContext.severity,
          clientContext.conditionCategory
        )
      } else {
        // Fallback: filter out events with trigger conditions if no context
        const generalEvents = decisionEvents.filter(e => !e.triggerConditions)
        if (generalEvents.length > 0) {
          decisionEvent = generalEvents[Math.floor(Math.random() * generalEvents.length)]
        }
      }
    }

    return {
      session: updatedSession,
      progressDelta,
      decisionEvent,
    }
  },

  /**
   * Select a random applicable decision event
   * Filters events based on client severity and condition category
   */
  selectDecisionEvent(
    events: DecisionEvent[],
    clientSeverity: number,
    clientConditionCategory: Client['conditionCategory']
  ): DecisionEvent | undefined {
    if (events.length === 0) return undefined

    // Filter applicable events based on trigger conditions
    const applicable = events.filter((event) => {
      if (!event.triggerConditions) return true

      // Check severity requirement
      if (event.triggerConditions.minSeverity !== undefined) {
        if (clientSeverity < event.triggerConditions.minSeverity) {
          return false
        }
      }

      // Check condition category requirement
      if (event.triggerConditions.conditionCategories !== undefined) {
        if (!event.triggerConditions.conditionCategories.includes(clientConditionCategory)) {
          return false
        }
      }

      return true
    })

    if (applicable.length === 0) return undefined

    // Random selection
    return applicable[Math.floor(Math.random() * applicable.length)]
  },

  /**
   * Apply a decision choice to a session
   */
  applyDecision(
    session: Session,
    therapist: Therapist,
    event: DecisionEvent,
    choiceIndex: number
  ): { session: Session; therapist: Therapist } {
    const choice = event.choices[choiceIndex]
    if (!choice) return { session, therapist }

    const decision: DecisionChoice = {
      eventId: event.id,
      choiceIndex,
      effects: choice.effects,
    }

    // Apply quality effect
    let newQuality = session.quality
    if (choice.effects.quality) {
      newQuality = Math.max(0, Math.min(1, session.quality + choice.effects.quality))
    }

    // Add quality modifier for the decision
    const newModifiers = [...session.qualityModifiers]
    if (choice.effects.quality) {
      newModifiers.push({
        source: `decision_${event.id}`,
        value: choice.effects.quality,
        description: choice.text.slice(0, 50),
      })
    }

    const updatedSession: Session = {
      ...session,
      quality: newQuality,
      qualityModifiers: newModifiers,
      decisionsMade: [...session.decisionsMade, decision],
    }

    // Apply energy effect
    let newEnergy = therapist.energy
    if (choice.effects.energy) {
      newEnergy = Math.max(0, Math.min(therapist.maxEnergy, therapist.energy + choice.effects.energy))
    }

    const updatedTherapist: Therapist = {
      ...therapist,
      energy: newEnergy,
    }

    return {
      session: updatedSession,
      therapist: updatedTherapist,
    }
  },

  /**
   * Check if a session is complete (progress >= 1)
   */
  isSessionComplete(session: Session): boolean {
    return session.status === 'in_progress' && session.progress >= 1
  },

  /**
   * Complete a session and calculate outcomes
   */
  completeSession(
    session: Session,
    therapist: Therapist,
    client: Client,
    currentTime: GameTime
  ): SessionCompleteResult {
    // Calculate final quality (clamp to 0-1)
    const finalQuality = Math.max(0, Math.min(1, session.quality))

    // Calculate XP gained
    const baseXP = SESSION_CONFIG.BASE_XP * (session.durationMinutes / 50)
    const qualityMultiplier =
      finalQuality >= SESSION_CONFIG.HIGH_QUALITY_THRESHOLD
        ? SESSION_CONFIG.HIGH_QUALITY_XP_MULTIPLIER
        : 1
    const xpGained = Math.round(baseXP * qualityMultiplier * (1 + finalQuality))

    // Calculate satisfaction change
    const satisfactionChange = Math.round(
      SESSION_CONFIG.BASE_SATISFACTION_CHANGE * (finalQuality * 2 - 0.5)
    )

    // Check if session had a crisis-related decision (can cause regression)
    const hadCrisisDecision = session.decisionsMade.some((d) =>
      d.eventId.includes('crisis') || d.eventId.includes('trauma')
    )

    // Calculate treatment progress with non-linear effects
    const progressResult = this.calculateTreatmentProgress(
      finalQuality,
      client.satisfaction,
      hadCrisisDecision,
      Date.now() + session.id.charCodeAt(0)
    )
    const treatmentProgressGained = progressResult.progressGained

    // Update session
    const completedSession: Session = {
      ...session,
      status: 'completed',
      progress: 1,
      quality: finalQuality,
      xpGained,
      completedAt: currentTime,
    }

    // Update therapist
    const newXP = therapist.xp + xpGained
    const newLevel = this.calculateLevel(newXP)
    const leveledUp = newLevel > therapist.level
    const newEnergy = Math.max(0, therapist.energy - session.energyCost)

    const updatedTherapist: Therapist = {
      ...therapist,
      energy: newEnergy,
      xp: newXP,
      level: newLevel,
      status: 'available',
    }

    // Update client
    const newSatisfaction = Math.max(0, Math.min(100, client.satisfaction + satisfactionChange))
    const newTreatmentProgress = Math.min(1, client.treatmentProgress + treatmentProgressGained)
    const newSessionsCompleted = client.sessionsCompleted + 1
    const isComplete = newSessionsCompleted >= client.sessionsRequired || newTreatmentProgress >= 1

    const updatedClient: Client = {
      ...client,
      satisfaction: newSatisfaction,
      treatmentProgress: newTreatmentProgress,
      sessionsCompleted: newSessionsCompleted,
      status: isComplete ? 'completed' : 'in_treatment',
    }

    return {
      session: completedSession,
      therapist: updatedTherapist,
      client: updatedClient,
      xpGained,
      leveledUp,
      newLevel,
      satisfactionChange,
      treatmentProgressGained,
      progressType: progressResult.progressType,
      progressDescription: progressResult.description,
      paymentAmount: session.payment,
    }
  },

  /**
   * Calculate level from XP
   */
  calculateLevel(xp: number): number {
    // Simple level formula: level = floor(sqrt(xp / 10)) + 1
    // Level 1: 0 XP, Level 2: 10 XP, Level 3: 40 XP, Level 4: 90 XP, etc.
    return Math.floor(Math.sqrt(xp / 10)) + 1
  },

  /**
   * Calculate XP needed for a level
   */
  xpForLevel(level: number): number {
    return (level - 1) * (level - 1) * 10
  },

  /**
   * Cancel a session
   */
  cancelSession(
    session: Session,
    therapist: Therapist,
    client: Client,
    reason: string
  ): { session: Session; therapist: Therapist; client: Client } {
    const cancelledSession: Session = {
      ...session,
      status: 'cancelled',
      qualityModifiers: [
        ...session.qualityModifiers,
        { source: 'cancelled', value: 0, description: reason },
      ],
    }

    // Restore therapist status if was in session
    const updatedTherapist: Therapist = {
      ...therapist,
      status: therapist.status === 'in_session' ? 'available' : therapist.status,
    }

    // Reduce client satisfaction for cancellation
    const updatedClient: Client = {
      ...client,
      satisfaction: Math.max(0, client.satisfaction - 10),
    }

    return {
      session: cancelledSession,
      therapist: updatedTherapist,
      client: updatedClient,
    }
  },

  /**
   * Get sessions that should start at the current time
   */
  getSessionsToStart(sessions: Session[], currentTime: GameTime): Session[] {
    return sessions.filter((s) => this.shouldStartSession(s, currentTime))
  },

  /**
   * Get currently active (in_progress) sessions
   */
  getActiveSessions(sessions: Session[]): Session[] {
    return sessions.filter((s) => s.status === 'in_progress')
  },

  /**
   * Get session quality as a text rating
   */
  getQualityRating(quality: number): string {
    if (quality >= 0.9) return 'Excellent'
    if (quality >= 0.75) return 'Good'
    if (quality >= 0.5) return 'Fair'
    if (quality >= 0.25) return 'Poor'
    return 'Very Poor'
  },

  /**
   * Get quality rating color variant
   */
  getQualityVariant(quality: number): 'success' | 'warning' | 'error' {
    if (quality >= 0.7) return 'success'
    if (quality >= 0.4) return 'warning'
    return 'error'
  },
}
