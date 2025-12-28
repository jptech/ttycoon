import type {
  Therapist,
  TherapistStatus,
  TherapistTraits,
  TherapistWorkSchedule,
  Certification,
  Specialization,
  ActiveTraining,
  TrainingProgram,
  CredentialType,
  TherapeuticModality,
  ConditionCategory,
  Session,
  Schedule,
} from '@/core/types'

/**
 * Configuration for therapist mechanics
 */
export const THERAPIST_CONFIG = {
  /** Base energy for all therapists */
  BASE_MAX_ENERGY: 100,
  /** Energy cost per standard session */
  SESSION_ENERGY_COST: 15,
  /** Energy cost for extended (80 min) session */
  EXTENDED_SESSION_ENERGY_COST: 25,
  /** Energy cost for intensive (180 min) session */
  INTENSIVE_SESSION_ENERGY_COST: 45,
  /** Energy recovered per hour of rest */
  ENERGY_RECOVERY_PER_HOUR: 10,
  /** Energy threshold for burnout risk */
  BURNOUT_THRESHOLD: 20,
  /** Energy threshold for forced break */
  FORCED_BREAK_THRESHOLD: 10,
  /** Days to recover from burnout */
  BURNOUT_RECOVERY_DAYS: 2,
  /** Progress per day during burnout recovery */
  BURNOUT_RECOVERY_PER_DAY: 50,
  /** Base XP per session */
  BASE_XP_PER_SESSION: 25,
  /** XP multiplier for high quality sessions */
  QUALITY_XP_MULTIPLIER: 1.5,
  /** XP needed for level 2 (scales up) */
  BASE_XP_FOR_LEVEL: 100,
  /** XP scaling factor per level */
  XP_SCALING_FACTOR: 1.5,
  /** Max therapist level */
  MAX_LEVEL: 50,
  /** Skill bonus per level */
  SKILL_PER_LEVEL: 1,
  /** Max skill value */
  MAX_SKILL: 100,
  /** Base hiring cost multiplier (skill * this) */
  HIRING_COST_MULTIPLIER: 100,
  /** Minimum hourly salary (USD/hr) */
  MIN_HOURLY_SALARY: 25,
  /** Typical hourly salary (USD/hr) */
  TYPICAL_HOURLY_SALARY: 30,
  /** Maximum hourly salary (USD/hr) */
  MAX_HOURLY_SALARY: 50,

  /** Hourly salary adjustment at +/-50 skill from mid-skill (50) */
  SALARY_SKILL_SPREAD: 18,
  /** Hourly salary bonus per certification */
  SALARY_CERT_BONUS: 1.75,
  /** Hourly salary bonus per level above 1 */
  SALARY_LEVEL_BONUS: 0.25,
  /** Stddev of random hourly salary noise (USD/hr) */
  SALARY_NOISE_STDDEV: 2.25,
} as const

/**
 * Default work schedule for new therapists
 */
export const DEFAULT_WORK_SCHEDULE: TherapistWorkSchedule = {
  workStartHour: 8,
  workEndHour: 17,
  breakHours: [], // No breaks by default
}

/**
 * Maximum number of breaks allowed per day
 */
export const MAX_BREAKS_PER_DAY = 3

/**
 * Energy forecast for a therapist's day
 */
export interface EnergyForecast {
  /** Predicted energy at end of day */
  predictedEndEnergy: number
  /** Number of scheduled sessions */
  scheduledSessionCount: number
  /** Total energy cost of scheduled sessions */
  totalEnergyCost: number
  /** Whether therapist will burn out during the day */
  willBurnOut: boolean
  /** Hour at which burnout would occur (if willBurnOut is true) */
  burnoutHour: number | null
}

/**
 * Credential configuration - salary multipliers and characteristics
 */
export const CREDENTIAL_CONFIG: Record<CredentialType, {
  name: string
  abbreviation: string
  salaryMultiplier: number // Multiplier on base salary
  minPracticeLevel: number // Minimum practice level to see in hiring pool
  canSupervise: boolean // Can supervise other therapists
  description: string
}> = {
  LMFT: {
    name: 'Licensed Marriage & Family Therapist',
    abbreviation: 'LMFT',
    salaryMultiplier: 1.0,
    minPracticeLevel: 1,
    canSupervise: false,
    description: 'Specializes in relationship and family dynamics',
  },
  LCSW: {
    name: 'Licensed Clinical Social Worker',
    abbreviation: 'LCSW',
    salaryMultiplier: 1.0,
    minPracticeLevel: 1,
    canSupervise: false,
    description: 'Holistic approach including social factors',
  },
  LPC: {
    name: 'Licensed Professional Counselor',
    abbreviation: 'LPC',
    salaryMultiplier: 0.95,
    minPracticeLevel: 1,
    canSupervise: false,
    description: 'General mental health counseling',
  },
  LPCC: {
    name: 'Licensed Professional Clinical Counselor',
    abbreviation: 'LPCC',
    salaryMultiplier: 1.05,
    minPracticeLevel: 2,
    canSupervise: true,
    description: 'Advanced clinical counselor with supervision rights',
  },
  PsyD: {
    name: 'Doctor of Psychology',
    abbreviation: 'PsyD',
    salaryMultiplier: 1.25,
    minPracticeLevel: 3,
    canSupervise: true,
    description: 'Doctorate focused on clinical practice',
  },
  PhD: {
    name: 'Doctor of Philosophy in Psychology',
    abbreviation: 'PhD',
    salaryMultiplier: 1.30,
    minPracticeLevel: 4,
    canSupervise: true,
    description: 'Research doctorate with clinical expertise',
  },
}

/**
 * Modality configuration - condition matching bonuses
 */
export const MODALITY_CONFIG: Record<TherapeuticModality, {
  name: string
  description: string
  /** Conditions this modality is particularly effective for */
  strongMatch: ConditionCategory[]
  /** Quality bonus when treating a strong match condition (0.0-0.15) */
  matchBonus: number
}> = {
  CBT: {
    name: 'Cognitive Behavioral Therapy',
    description: 'Structured, goal-oriented therapy focusing on thoughts and behaviors',
    strongMatch: ['anxiety', 'depression', 'behavioral'],
    matchBonus: 0.10,
  },
  DBT: {
    name: 'Dialectical Behavior Therapy',
    description: 'Skills-based therapy for emotional regulation',
    strongMatch: ['behavioral', 'stress'],
    matchBonus: 0.12,
  },
  Psychodynamic: {
    name: 'Psychodynamic Therapy',
    description: 'Insight-oriented therapy exploring unconscious patterns',
    strongMatch: ['depression', 'relationship'],
    matchBonus: 0.08,
  },
  Humanistic: {
    name: 'Humanistic/Person-Centered',
    description: 'Empathetic, client-led therapeutic relationship',
    strongMatch: ['stress', 'depression'],
    matchBonus: 0.08,
  },
  EMDR: {
    name: 'Eye Movement Desensitization & Reprocessing',
    description: 'Specialized trauma processing technique',
    strongMatch: ['trauma'],
    matchBonus: 0.15,
  },
  Somatic: {
    name: 'Somatic Therapy',
    description: 'Body-based approach to trauma and stress',
    strongMatch: ['trauma', 'stress'],
    matchBonus: 0.12,
  },
  FamilySystems: {
    name: 'Family Systems Therapy',
    description: 'Systemic approach to family and relationship dynamics',
    strongMatch: ['relationship'],
    matchBonus: 0.12,
  },
  Integrative: {
    name: 'Integrative/Eclectic',
    description: 'Flexible approach drawing from multiple modalities',
    strongMatch: [],
    matchBonus: 0.05, // Small bonus for all conditions
  },
}

/**
 * Result of processing a session for therapist
 */
export interface SessionWorkResult {
  updatedTherapist: Therapist
  energySpent: number
  xpGained: number
  leveledUp: boolean
  burnedOut: boolean
}

/**
 * Result of resting/recovering
 */
export interface RestResult {
  updatedTherapist: Therapist
  energyRecovered: number
  recoveredFromBurnout: boolean
}

/**
 * Result of completing training
 */
export interface TrainingResult {
  updatedTherapist: Therapist
  programCompleted: boolean
  certificationsGained: Certification[]
  skillGained: number
}

/**
 * Hiring candidate info
 */
export interface HiringCandidate {
  therapist: Therapist
  hiringCost: number
  monthlySalary: number
}

/**
 * Pure therapist management functions
 */
export const TherapistManager = {
  /**
   * Create the player's therapist
   */
  createPlayerTherapist(displayName: string, credential: CredentialType = 'LPC', modality: TherapeuticModality = 'Integrative'): Therapist {
    return {
      id: 'player',
      displayName,
      isPlayer: true,
      credential,
      primaryModality: modality,
      secondaryModalities: [],
      energy: THERAPIST_CONFIG.BASE_MAX_ENERGY,
      maxEnergy: THERAPIST_CONFIG.BASE_MAX_ENERGY,
      baseSkill: 40,
      level: 1,
      xp: 0,
      hourlySalary: 0,
      hireDay: 1,
      certifications: [],
      specializations: ['stress_management'],
      status: 'available',
      burnoutRecoveryProgress: 0,
      traits: {
        warmth: 7,
        analytical: 5,
        creativity: 5,
      },
      workSchedule: { ...DEFAULT_WORK_SCHEDULE },
    }
  },

  /**
   * Generate a hireable therapist
   */
  generateTherapist(
    currentDay: number,
    practiceLevel: number,
    seed?: number
  ): HiringCandidate {
    const random = seed !== undefined ? seededRandom(seed) : Math.random

    const id = crypto.randomUUID()

    // Pick credential based on practice level
    const credential = pickRandomCredential(practiceLevel, random)
    const credentialConfig = CREDENTIAL_CONFIG[credential]

    // Generate name with appropriate title
    const displayName = generateTherapistName(credential, random)

    // Skill based on practice level (better candidates at higher levels)
    // Doctoral credentials get a skill boost
    const credentialSkillBoost = credential === 'PsyD' || credential === 'PhD' ? 10 : 0
    const minSkill = 30 + practiceLevel * 5 + credentialSkillBoost
    const maxSkill = Math.min(90, 50 + practiceLevel * 8 + credentialSkillBoost)
    const baseSkill = randomInt(minSkill, maxSkill, random)

    // Level based on skill
    const level = Math.max(1, Math.floor(baseSkill / 10))

    // Pick modalities - primary and possibly secondary
    const primaryModality = pickRandomModality(random)
    const secondaryModalities = random() > 0.6 ? [pickRandomModality(random, [primaryModality])] : []

    // Random certifications (more at higher skill)
    const certCount = Math.floor(random() * (baseSkill / 25)) + (baseSkill > 60 ? 1 : 0)
    const certifications = pickRandomCertifications(certCount, random)

    // Random specializations
    const specCount = randomInt(1, 3, random)
    const specializations = pickRandomSpecializations(specCount, random)

    // Traits
    const traits: TherapistTraits = {
      warmth: randomInt(3, 10, random),
      analytical: randomInt(3, 10, random),
      creativity: randomInt(3, 10, random),
    }

    // Salary: realistic hourly range with correlation to skill/experience + credential multiplier
    const skillDelta = (baseSkill - 50) / 50
    const baseSalary =
      THERAPIST_CONFIG.TYPICAL_HOURLY_SALARY +
      skillDelta * THERAPIST_CONFIG.SALARY_SKILL_SPREAD +
      certifications.length * THERAPIST_CONFIG.SALARY_CERT_BONUS +
      Math.max(0, level - 1) * THERAPIST_CONFIG.SALARY_LEVEL_BONUS

    // Apply credential multiplier
    const credentialAdjustedSalary = baseSalary * credentialConfig.salaryMultiplier

    const noisyHourly = credentialAdjustedSalary + randomNormal(0, THERAPIST_CONFIG.SALARY_NOISE_STDDEV, random)

    const hourlySalary = Math.round(
      clamp(noisyHourly, THERAPIST_CONFIG.MIN_HOURLY_SALARY, THERAPIST_CONFIG.MAX_HOURLY_SALARY * credentialConfig.salaryMultiplier)
    )

    const certBonus = certifications.length * 10

    const therapist: Therapist = {
      id,
      displayName,
      isPlayer: false,
      credential,
      primaryModality,
      secondaryModalities,
      energy: THERAPIST_CONFIG.BASE_MAX_ENERGY,
      maxEnergy: THERAPIST_CONFIG.BASE_MAX_ENERGY,
      baseSkill,
      level,
      xp: 0,
      hourlySalary,
      hireDay: currentDay,
      certifications,
      specializations,
      status: 'available',
      burnoutRecoveryProgress: 0,
      traits,
      workSchedule: { ...DEFAULT_WORK_SCHEDULE },
    }

    // Hiring cost - credential affects hiring cost too
    const credentialHiringMultiplier = credential === 'PhD' || credential === 'PsyD' ? 1.5 : 1.0
    const hiringCost = Math.round((baseSkill * THERAPIST_CONFIG.HIRING_COST_MULTIPLIER + certBonus * 50) * credentialHiringMultiplier)
    const monthlySalary = hourlySalary * 8 * 22 // 8 hours/day, 22 work days/month

    return { therapist, hiringCost, monthlySalary }
  },

  /**
   * Process energy cost from completing a session
   */
  processSessionWork(
    therapist: Therapist,
    sessionDuration: 50 | 80 | 180,
    sessionQuality: number
  ): SessionWorkResult {
    // Calculate energy cost
    let energyCost: number
    switch (sessionDuration) {
      case 80:
        energyCost = THERAPIST_CONFIG.EXTENDED_SESSION_ENERGY_COST
        break
      case 180:
        energyCost = THERAPIST_CONFIG.INTENSIVE_SESSION_ENERGY_COST
        break
      default:
        energyCost = THERAPIST_CONFIG.SESSION_ENERGY_COST
    }

    const newEnergy = Math.max(0, therapist.energy - energyCost)

    // Calculate XP
    const qualityMultiplier = sessionQuality >= 0.8 ? THERAPIST_CONFIG.QUALITY_XP_MULTIPLIER : 1
    const xpGained = Math.round(THERAPIST_CONFIG.BASE_XP_PER_SESSION * qualityMultiplier)
    const newXp = therapist.xp + xpGained

    // Check for level up
    const xpForNextLevel = this.getXpForLevel(therapist.level + 1)
    const leveledUp = newXp >= xpForNextLevel && therapist.level < THERAPIST_CONFIG.MAX_LEVEL
    const newLevel = leveledUp ? therapist.level + 1 : therapist.level
    const remainingXp = leveledUp ? newXp - xpForNextLevel : newXp

    // Skill increase on level up
    const newSkill = leveledUp
      ? Math.min(THERAPIST_CONFIG.MAX_SKILL, therapist.baseSkill + THERAPIST_CONFIG.SKILL_PER_LEVEL)
      : therapist.baseSkill

    // Check for burnout
    const burnedOut = newEnergy <= THERAPIST_CONFIG.FORCED_BREAK_THRESHOLD

    const updatedTherapist: Therapist = {
      ...therapist,
      energy: newEnergy,
      xp: remainingXp,
      level: newLevel,
      baseSkill: newSkill,
      status: burnedOut ? 'burned_out' : therapist.status,
      burnoutRecoveryProgress: burnedOut ? 0 : therapist.burnoutRecoveryProgress,
    }

    return {
      updatedTherapist,
      energySpent: energyCost,
      xpGained,
      leveledUp,
      burnedOut,
    }
  },

  /**
   * Process rest/recovery (called at end of day or during break)
   */
  processRest(therapist: Therapist, hours: number): RestResult {
    // Handle burnout recovery
    if (therapist.status === 'burned_out') {
      const newProgress = therapist.burnoutRecoveryProgress + THERAPIST_CONFIG.BURNOUT_RECOVERY_PER_DAY
      const recovered = newProgress >= 100

      return {
        updatedTherapist: {
          ...therapist,
          burnoutRecoveryProgress: recovered ? 0 : newProgress,
          status: recovered ? 'available' : 'burned_out',
          energy: recovered ? therapist.maxEnergy : therapist.energy,
        },
        energyRecovered: recovered ? therapist.maxEnergy - therapist.energy : 0,
        recoveredFromBurnout: recovered,
      }
    }

    // Normal energy recovery
    const recoveryAmount = hours * THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR
    const newEnergy = Math.min(therapist.maxEnergy, therapist.energy + recoveryAmount)
    const actualRecovered = newEnergy - therapist.energy

    return {
      updatedTherapist: {
        ...therapist,
        energy: newEnergy,
        status: therapist.status === 'on_break' && newEnergy >= 50 ? 'available' : therapist.status,
      },
      energyRecovered: actualRecovered,
      recoveredFromBurnout: false,
    }
  },

  /**
   * Process training progress
   */
  processTraining(
    therapist: Therapist,
    training: ActiveTraining,
    program: TrainingProgram,
    hoursWorked: number
  ): { updatedTherapist: Therapist; updatedTraining: ActiveTraining; completed: boolean } {
    const newHoursCompleted = training.hoursCompleted + hoursWorked
    const completed = newHoursCompleted >= program.durationHours

    const updatedTherapist = { ...therapist }

    if (completed) {
      // Apply training grants
      if (program.grants.certification && !therapist.certifications.includes(program.grants.certification)) {
        updatedTherapist.certifications = [...therapist.certifications, program.grants.certification]
      }
      if (program.grants.skillBonus) {
        updatedTherapist.baseSkill = Math.min(
          THERAPIST_CONFIG.MAX_SKILL,
          therapist.baseSkill + program.grants.skillBonus
        )
      }
      updatedTherapist.status = 'available'
    }

    return {
      updatedTherapist,
      updatedTraining: {
        ...training,
        hoursCompleted: Math.min(newHoursCompleted, program.durationHours),
      },
      completed,
    }
  },

  /**
   * Start training for therapist
   */
  startTraining(therapist: Therapist, program: TrainingProgram, currentDay: number): ActiveTraining {
    return {
      programId: program.id,
      therapistId: therapist.id,
      startDay: currentDay,
      hoursCompleted: 0,
      totalHours: program.durationHours,
    }
  },

  /**
   * Set therapist status
   */
  setStatus(therapist: Therapist, status: TherapistStatus): Therapist {
    return { ...therapist, status }
  },

  /**
   * Calculate XP needed for a specific level
   */
  getXpForLevel(level: number): number {
    if (level <= 1) return 0
    return Math.round(
      THERAPIST_CONFIG.BASE_XP_FOR_LEVEL * Math.pow(THERAPIST_CONFIG.XP_SCALING_FACTOR, level - 2)
    )
  },

  /**
   * Get effective skill (base + level bonuses)
   */
  getEffectiveSkill(therapist: Therapist): number {
    return therapist.baseSkill
  },

  /**
   * Check if therapist is at burnout risk
   */
  isBurnoutRisk(therapist: Therapist): boolean {
    return therapist.energy <= THERAPIST_CONFIG.BURNOUT_THRESHOLD && therapist.status !== 'burned_out'
  },

  /**
   * Check if therapist can take a session
   */
  canTakeSession(therapist: Therapist, duration: 50 | 80 | 180): boolean {
    if (therapist.status !== 'available') return false

    const cost =
      duration === 180
        ? THERAPIST_CONFIG.INTENSIVE_SESSION_ENERGY_COST
        : duration === 80
          ? THERAPIST_CONFIG.EXTENDED_SESSION_ENERGY_COST
          : THERAPIST_CONFIG.SESSION_ENERGY_COST

    return therapist.energy >= cost
  },

  /**
   * Check if therapist can start training
   */
  canStartTraining(therapist: Therapist, program: TrainingProgram): { canStart: boolean; reason?: string } {
    if (therapist.status !== 'available') {
      return { canStart: false, reason: 'Therapist is not available' }
    }

    if (program.prerequisites.minSkill && therapist.baseSkill < program.prerequisites.minSkill) {
      return { canStart: false, reason: `Requires skill level ${program.prerequisites.minSkill}` }
    }

    if (program.prerequisites.certifications) {
      const missingCerts = program.prerequisites.certifications.filter(
        (c) => !therapist.certifications.includes(c)
      )
      if (missingCerts.length > 0) {
        return { canStart: false, reason: `Missing certifications: ${missingCerts.join(', ')}` }
      }
    }

    // Check credential requirements
    if (program.prerequisites.requiredCredentials && program.prerequisites.requiredCredentials.length > 0) {
      if (!program.prerequisites.requiredCredentials.includes(therapist.credential)) {
        const credentialNames = program.prerequisites.requiredCredentials
          .map((c) => CREDENTIAL_CONFIG[c]?.abbreviation || c)
          .join(', ')
        return { canStart: false, reason: `Requires credential: ${credentialNames}` }
      }
    }

    if (program.grants.certification && therapist.certifications.includes(program.grants.certification)) {
      return { canStart: false, reason: 'Already has this certification' }
    }

    return { canStart: true }
  },

  /**
   * Get therapist by ID
   */
  getTherapist(therapists: Therapist[], id: string): Therapist | undefined {
    return therapists.find((t) => t.id === id)
  },

  /**
   * Get available therapists
   */
  getAvailableTherapists(therapists: Therapist[]): Therapist[] {
    return therapists.filter((t) => t.status === 'available')
  },

  /**
   * Get therapists sorted by skill
   */
  getTherapistsBySkill(therapists: Therapist[]): Therapist[] {
    return [...therapists].sort((a, b) => b.baseSkill - a.baseSkill)
  },

  /**
   * Get therapist stats summary
   */
  getTherapistStats(therapists: Therapist[]): {
    total: number
    available: number
    inSession: number
    onBreak: number
    inTraining: number
    burnedOut: number
    avgEnergy: number
    avgSkill: number
  } {
    const total = therapists.length
    const available = therapists.filter((t) => t.status === 'available').length
    const inSession = therapists.filter((t) => t.status === 'in_session').length
    const onBreak = therapists.filter((t) => t.status === 'on_break').length
    const inTraining = therapists.filter((t) => t.status === 'in_training').length
    const burnedOut = therapists.filter((t) => t.status === 'burned_out').length

    const avgEnergy = total > 0 ? Math.round(therapists.reduce((sum, t) => sum + t.energy, 0) / total) : 0
    const avgSkill = total > 0 ? Math.round(therapists.reduce((sum, t) => sum + t.baseSkill, 0) / total) : 0

    return { total, available, inSession, onBreak, inTraining, burnedOut, avgEnergy, avgSkill }
  },

  /**
   * Calculate monthly salary cost for all hired therapists
   */
  getMonthlySalaryCost(therapists: Therapist[]): number {
    return therapists
      .filter((t) => !t.isPlayer)
      .reduce((sum, t) => sum + t.hourlySalary * 8 * 22, 0)
  },

  /**
   * Format therapist summary for display
   */
  formatTherapistSummary(therapist: Therapist): string {
    return `${therapist.displayName} - Level ${therapist.level} (Skill: ${therapist.baseSkill})`
  },

  /**
   * Calculate modality match bonus for a therapist treating a specific condition
   * Returns a quality bonus (0.0 to ~0.15) based on modality-condition match
   * HIGH-020 fix: Added null checks to prevent potential undefined access
   */
  getModalityMatchBonus(therapist: Therapist, conditionCategory: ConditionCategory): number {
    const primaryConfig = MODALITY_CONFIG[therapist.primaryModality]

    // HIGH-020 fix: Guard against missing modality config
    if (!primaryConfig) {
      return 0
    }

    // Check primary modality match
    if (primaryConfig.strongMatch.includes(conditionCategory)) {
      return primaryConfig.matchBonus
    }

    // Check secondary modalities (reduced bonus)
    for (const modality of therapist.secondaryModalities) {
      const config = MODALITY_CONFIG[modality]
      // HIGH-020 fix: Guard against missing secondary modality config
      if (config?.strongMatch.includes(conditionCategory)) {
        return config.matchBonus * 0.5 // Half bonus for secondary
      }
    }

    // Integrative gets a small bonus for everything
    if (therapist.primaryModality === 'Integrative') {
      return MODALITY_CONFIG.Integrative.matchBonus
    }

    return 0
  },

  /**
   * Get credential display info
   */
  getCredentialInfo(credential: CredentialType): typeof CREDENTIAL_CONFIG[CredentialType] {
    return CREDENTIAL_CONFIG[credential]
  },

  /**
   * Get modality display info
   */
  getModalityInfo(modality: TherapeuticModality): typeof MODALITY_CONFIG[TherapeuticModality] {
    return MODALITY_CONFIG[modality]
  },

  /**
   * Check if therapist can supervise others
   */
  canSupervise(therapist: Therapist): boolean {
    return CREDENTIAL_CONFIG[therapist.credential].canSupervise
  },

  /**
   * Get energy display info
   */
  getEnergyDisplay(therapist: Therapist): {
    percentage: number
    status: 'good' | 'warning' | 'critical'
    label: string
  } {
    const percentage = Math.round((therapist.energy / therapist.maxEnergy) * 100)

    let status: 'good' | 'warning' | 'critical'
    if (percentage > 50) {
      status = 'good'
    } else if (percentage > THERAPIST_CONFIG.BURNOUT_THRESHOLD) {
      status = 'warning'
    } else {
      status = 'critical'
    }

    return { percentage, status, label: `${therapist.energy}/${therapist.maxEnergy}` }
  },

  // ==================== WORK SCHEDULE UTILITIES ====================

  /**
   * Get therapist's work schedule with defaults applied
   */
  getWorkSchedule(therapist: Therapist): TherapistWorkSchedule {
    return therapist.workSchedule ?? { ...DEFAULT_WORK_SCHEDULE }
  },

  /**
   * Check if an hour is within a therapist's work hours
   */
  isWithinWorkHours(therapist: Therapist, hour: number): boolean {
    const schedule = this.getWorkSchedule(therapist)

    // Check if within work hours
    if (hour < schedule.workStartHour || hour >= schedule.workEndHour) {
      return false
    }

    // Check if on any break
    if (schedule.breakHours.includes(hour)) {
      return false
    }

    return true
  },

  /**
   * Get available work hours for a therapist (excluding breaks)
   */
  getWorkHours(therapist: Therapist): number[] {
    const schedule = this.getWorkSchedule(therapist)
    const hours: number[] = []

    for (let hour = schedule.workStartHour; hour < schedule.workEndHour; hour++) {
      if (!schedule.breakHours.includes(hour)) {
        hours.push(hour)
      }
    }

    return hours
  },

  /**
   * Get total working hours per day for a therapist
   */
  getWorkingHoursPerDay(therapist: Therapist): number {
    const schedule = this.getWorkSchedule(therapist)
    const totalHours = schedule.workEndHour - schedule.workStartHour
    const breakCount = schedule.breakHours.length
    return totalHours - breakCount
  },

  /**
   * Update a therapist's work schedule
   */
  updateWorkSchedule(therapist: Therapist, updates: Partial<TherapistWorkSchedule>): Therapist {
    return {
      ...therapist,
      workSchedule: {
        ...this.getWorkSchedule(therapist),
        ...updates,
      },
    }
  },

  /**
   * Validate work schedule changes
   */
  validateWorkSchedule(schedule: TherapistWorkSchedule): { valid: boolean; reason?: string } {
    // Work hours must be within business day (6am - 10pm as reasonable bounds)
    if (schedule.workStartHour < 6 || schedule.workStartHour > 22) {
      return { valid: false, reason: 'Start hour must be between 6am and 10pm' }
    }
    if (schedule.workEndHour < 6 || schedule.workEndHour > 22) {
      return { valid: false, reason: 'End hour must be between 6am and 10pm' }
    }

    // End must be after start
    if (schedule.workEndHour <= schedule.workStartHour) {
      return { valid: false, reason: 'End hour must be after start hour' }
    }

    // Minimum 4 hours of work
    const totalHours = schedule.workEndHour - schedule.workStartHour
    if (totalHours < 4) {
      return { valid: false, reason: 'Work day must be at least 4 hours' }
    }

    // Validate breaks
    if (schedule.breakHours.length > MAX_BREAKS_PER_DAY) {
      return { valid: false, reason: `Maximum ${MAX_BREAKS_PER_DAY} breaks allowed` }
    }

    // All breaks must be within work hours
    for (const breakHour of schedule.breakHours) {
      if (breakHour < schedule.workStartHour || breakHour >= schedule.workEndHour) {
        return { valid: false, reason: 'All breaks must be within work hours' }
      }
    }

    // Check for duplicate breaks
    const uniqueBreaks = new Set(schedule.breakHours)
    if (uniqueBreaks.size !== schedule.breakHours.length) {
      return { valid: false, reason: 'Duplicate break hours are not allowed' }
    }

    // Ensure at least some working hours remain
    const workingHours = totalHours - schedule.breakHours.length
    if (workingHours < 3) {
      return { valid: false, reason: 'Must have at least 3 working hours after breaks' }
    }

    return { valid: true }
  },

  // ==================== ENERGY FORECASTING ====================

  /**
   * Calculate energy cost for a session duration
   */
  getSessionEnergyCost(duration: 50 | 80 | 180): number {
    switch (duration) {
      case 80:
        return THERAPIST_CONFIG.EXTENDED_SESSION_ENERGY_COST
      case 180:
        return THERAPIST_CONFIG.INTENSIVE_SESSION_ENERGY_COST
      default:
        return THERAPIST_CONFIG.SESSION_ENERGY_COST
    }
  },

  /**
   * Forecast energy for a therapist on a specific day
   * Returns predicted end-of-day energy and burnout risk
   */
  forecastEnergy(
    therapist: Therapist,
    sessions: Session[],
    _schedule: Schedule,
    day: number
  ): EnergyForecast {
    // Get sessions scheduled for this therapist on this day
    const daySessions = sessions.filter(
      (s) =>
        s.therapistId === therapist.id &&
        s.scheduledDay === day &&
        (s.status === 'scheduled' || s.status === 'in_progress')
    ).sort((a, b) => a.scheduledHour - b.scheduledHour)

    let currentEnergy = therapist.energy
    let totalEnergyCost = 0
    let burnoutHour: number | null = null

    for (const session of daySessions) {
      const cost = this.getSessionEnergyCost(session.durationMinutes)
      totalEnergyCost += cost
      currentEnergy -= cost

      if (currentEnergy <= THERAPIST_CONFIG.FORCED_BREAK_THRESHOLD && burnoutHour === null) {
        burnoutHour = session.scheduledHour
      }
    }

    const predictedEndEnergy = Math.max(0, currentEnergy)
    const willBurnOut = currentEnergy <= THERAPIST_CONFIG.FORCED_BREAK_THRESHOLD

    return {
      predictedEndEnergy,
      scheduledSessionCount: daySessions.length,
      totalEnergyCost,
      willBurnOut,
      burnoutHour,
    }
  },

  /**
   * Get a formatted energy forecast summary for display
   */
  formatEnergyForecast(forecast: EnergyForecast): string {
    if (forecast.scheduledSessionCount === 0) {
      return 'No sessions scheduled'
    }

    const sessionWord = forecast.scheduledSessionCount === 1 ? 'session' : 'sessions'
    const energyDisplay = `~${forecast.predictedEndEnergy} energy EOD`

    if (forecast.willBurnOut) {
      return `${forecast.scheduledSessionCount} ${sessionWord} • BURNOUT RISK`
    }

    return `${forecast.scheduledSessionCount} ${sessionWord} • ${energyDisplay}`
  },
}

// ==================== HELPER FUNCTIONS ====================

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function randomInt(min: number, max: number, random: () => number = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function randomNormal(mean: number, stddev: number, random: () => number = Math.random): number {
  // Box–Muller transform
  const u1 = Math.max(Number.EPSILON, random())
  const u2 = random()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + z0 * stddev
}

const FIRST_NAMES = [
  'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'James', 'Amanda', 'Robert',
  'Jennifer', 'William', 'Lisa', 'John', 'Karen', 'Richard', 'Nancy', 'Thomas',
  'Patricia', 'Christopher', 'Linda', 'Daniel', 'Elizabeth', 'Matthew', 'Maria',
]

const LAST_NAMES = [
  'Chen', 'Williams', 'Johnson', 'Smith', 'Brown', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson',
  'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson',
]

function generateTherapistName(credential: CredentialType, random: () => number): string {
  const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]
  // Doctoral credentials use "Dr.", others don't
  const title = credential === 'PsyD' || credential === 'PhD' ? 'Dr. ' : ''
  return `${title}${firstName} ${lastName}`
}

const ALL_CERTIFICATIONS: Certification[] = [
  'trauma_certified', 'couples_certified', 'supervisor_certified', 'telehealth_certified',
  'children_certified', 'substance_certified', 'emdr_certified', 'cbt_certified', 'dbt_certified',
]

function pickRandomCertifications(count: number, random: () => number): Certification[] {
  const shuffled = [...ALL_CERTIFICATIONS].sort(() => random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

const ALL_SPECIALIZATIONS: Specialization[] = [
  'children', 'couples', 'trauma', 'ptsd', 'anxiety_disorders', 'depression',
  'grief', 'eating_disorders', 'ocd', 'personality_disorders', 'substance_abuse', 'stress_management',
]

function pickRandomSpecializations(count: number, random: () => number): Specialization[] {
  const shuffled = [...ALL_SPECIALIZATIONS].sort(() => random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

const ALL_CREDENTIALS: CredentialType[] = ['LMFT', 'LCSW', 'LPC', 'LPCC', 'PsyD', 'PhD']

/**
 * Pick a random credential based on practice level
 * Higher practice levels unlock more prestigious credentials
 */
function pickRandomCredential(practiceLevel: number, random: () => number): CredentialType {
  // Filter credentials available at this practice level
  const availableCredentials = ALL_CREDENTIALS.filter(
    (cred) => CREDENTIAL_CONFIG[cred].minPracticeLevel <= practiceLevel
  )

  // Weight toward more common credentials at lower levels
  // At higher levels, doctoral credentials become more likely
  if (practiceLevel >= 4 && random() > 0.7) {
    // 30% chance of doctoral at level 4+
    const doctoralCreds = availableCredentials.filter(c => c === 'PsyD' || c === 'PhD')
    if (doctoralCreds.length > 0) {
      return doctoralCreds[Math.floor(random() * doctoralCreds.length)]
    }
  }

  if (practiceLevel >= 3 && random() > 0.8) {
    // 20% chance of PsyD at level 3
    if (availableCredentials.includes('PsyD')) {
      return 'PsyD'
    }
  }

  // Otherwise pick randomly from available (non-doctoral weighted more)
  const nonDoctoral = availableCredentials.filter(c => c !== 'PsyD' && c !== 'PhD')
  if (nonDoctoral.length > 0) {
    return nonDoctoral[Math.floor(random() * nonDoctoral.length)]
  }

  return availableCredentials[Math.floor(random() * availableCredentials.length)]
}

const ALL_MODALITIES: TherapeuticModality[] = [
  'CBT', 'DBT', 'Psychodynamic', 'Humanistic', 'EMDR', 'Somatic', 'FamilySystems', 'Integrative'
]

/**
 * Pick a random modality, optionally excluding some
 */
function pickRandomModality(random: () => number, exclude: TherapeuticModality[] = []): TherapeuticModality {
  const available = ALL_MODALITIES.filter(m => !exclude.includes(m))
  // CBT and Integrative are more common - add extra entries to weight them
  const extraCBT: TherapeuticModality[] = exclude.includes('CBT') ? [] : ['CBT']
  const extraIntegrative: TherapeuticModality[] = exclude.includes('Integrative') ? [] : ['Integrative']
  const weighted: TherapeuticModality[] = [...available, ...extraCBT, ...extraIntegrative]
  return weighted[Math.floor(random() * weighted.length)]
}
