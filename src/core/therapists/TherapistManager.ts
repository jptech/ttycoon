import type {
  Therapist,
  TherapistStatus,
  TherapistTraits,
  Certification,
  Specialization,
  ActiveTraining,
  TrainingProgram,
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
  BURNOUT_RECOVERY_DAYS: 3,
  /** Progress per day during burnout recovery */
  BURNOUT_RECOVERY_PER_DAY: 34,
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
  /** Minimum hourly salary */
  MIN_HOURLY_SALARY: 30,
  /** Maximum hourly salary */
  MAX_HOURLY_SALARY: 150,
} as const

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
  createPlayerTherapist(displayName: string): Therapist {
    return {
      id: 'player',
      displayName,
      isPlayer: true,
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
    const displayName = generateTherapistName(random)

    // Skill based on practice level (better candidates at higher levels)
    const minSkill = 30 + practiceLevel * 5
    const maxSkill = Math.min(80, 50 + practiceLevel * 8)
    const baseSkill = randomInt(minSkill, maxSkill, random)

    // Level based on skill
    const level = Math.max(1, Math.floor(baseSkill / 10))

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

    // Salary based on skill and certifications
    const certBonus = certifications.length * 10
    const hourlySalary = Math.round(
      THERAPIST_CONFIG.MIN_HOURLY_SALARY +
        ((baseSkill + certBonus) / 100) *
          (THERAPIST_CONFIG.MAX_HOURLY_SALARY - THERAPIST_CONFIG.MIN_HOURLY_SALARY)
    )

    const therapist: Therapist = {
      id,
      displayName,
      isPlayer: false,
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
    }

    // Hiring cost
    const hiringCost = Math.round(baseSkill * THERAPIST_CONFIG.HIRING_COST_MULTIPLIER + certBonus * 50)
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

function generateTherapistName(random: () => number): string {
  const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]
  const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]
  return `Dr. ${firstName} ${lastName}`
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
