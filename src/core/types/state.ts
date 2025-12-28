import type {
  Therapist,
  Client,
  Session,
  PendingClaim,
  ActiveTraining,
  GameModifier,
  Transaction,
  InsurerId,
  Schedule,
} from './entities'
import type { BuildingUpgradeState } from './office'

/**
 * Complete game state that can be saved/loaded
 */
export interface GameState {
  // Meta
  practiceName: string
  saveVersion: number

  // Time
  currentDay: number
  currentHour: number
  currentMinute: number
  gameSpeed: GameSpeed
  isPaused: boolean
  pauseReasons: string[]

  // Economy
  balance: number
  pendingClaims: PendingClaim[]
  insuranceMultiplier: number
  transactionHistory: Transaction[]
  reputationLog: ReputationLogEntry[]

  // Reputation
  reputation: number
  practiceLevel: PracticeLevel

  // Entities
  therapists: Therapist[]
  clients: Client[]
  sessions: Session[]

  // Scheduling
  schedule: Schedule
  waitingList: string[] // Client IDs

  // Training
  activeTrainings: ActiveTraining[]

  // Office
  currentBuildingId: string
  telehealthUnlocked: boolean
  buildingUpgrades: BuildingUpgradeState

  // Insurance
  activePanels: InsurerId[]

  // Clinic bonuses (from business training)
  hiringCapacityBonus: number // Extra therapists that can be hired beyond base level cap

  // Events
  eventCooldowns: Record<string, number> // eventId -> day when cooldown expires
  activeModifiers: GameModifier[]
  rememberedDecisions: Record<string, number> // eventId -> choiceIndex

  // Milestones
  achievedMilestones: MilestoneId[]

  // Settings
  autoResolveSessions: boolean
  soundEnabled: boolean
  musicEnabled: boolean
  showSessionSummaryModal: boolean
  showDaySummaryModal: boolean
  autoApplyDecisions: boolean
}

export type GameSpeed = 0 | 1 | 2 | 3

export type PracticeLevel = 1 | 2 | 3 | 4 | 5

export interface ReputationLogEntry {
  id: string
  day: number
  hour: number
  minute: number
  reason: string
  change: number
  before: number
  after: number
}

/**
 * Milestone types for one-time reputation bonuses
 */
export type MilestoneId =
  | 'first_session_completed'
  | 'first_week_completed'
  | 'first_client_cured'
  | 'first_employee_hired'
  | 'sessions_10_completed'
  | 'sessions_25_completed'
  | 'sessions_50_completed'
  | 'sessions_100_completed'
  | 'clients_5_cured'
  | 'clients_10_cured'
  | 'practice_level_2'
  | 'practice_level_3'
  | 'practice_level_4'
  | 'practice_level_5'

/**
 * Milestone configuration
 */
export interface MilestoneConfig {
  id: MilestoneId
  name: string
  description: string
  reputationBonus: number
}

/**
 * All available milestones
 */
export const MILESTONES: MilestoneConfig[] = [
  {
    id: 'first_session_completed',
    name: 'First Session',
    description: 'Complete your first therapy session',
    reputationBonus: 5,
  },
  {
    id: 'first_week_completed',
    name: 'First Week',
    description: 'Complete your first week of practice',
    reputationBonus: 10,
  },
  {
    id: 'first_client_cured',
    name: 'First Cure',
    description: 'Successfully complete treatment for a client',
    reputationBonus: 10,
  },
  {
    id: 'first_employee_hired',
    name: 'First Hire',
    description: 'Hire your first employee therapist',
    reputationBonus: 15,
  },
  {
    id: 'sessions_10_completed',
    name: '10 Sessions',
    description: 'Complete 10 therapy sessions',
    reputationBonus: 10,
  },
  {
    id: 'sessions_25_completed',
    name: '25 Sessions',
    description: 'Complete 25 therapy sessions',
    reputationBonus: 15,
  },
  {
    id: 'sessions_50_completed',
    name: '50 Sessions',
    description: 'Complete 50 therapy sessions',
    reputationBonus: 20,
  },
  {
    id: 'sessions_100_completed',
    name: 'Century Club',
    description: 'Complete 100 therapy sessions',
    reputationBonus: 30,
  },
  {
    id: 'clients_5_cured',
    name: '5 Success Stories',
    description: 'Successfully complete treatment for 5 clients',
    reputationBonus: 15,
  },
  {
    id: 'clients_10_cured',
    name: '10 Success Stories',
    description: 'Successfully complete treatment for 10 clients',
    reputationBonus: 25,
  },
  {
    id: 'practice_level_2',
    name: 'Growing Practice',
    description: 'Reach practice level 2',
    reputationBonus: 10,
  },
  {
    id: 'practice_level_3',
    name: 'Established Practice',
    description: 'Reach practice level 3',
    reputationBonus: 15,
  },
  {
    id: 'practice_level_4',
    name: 'Thriving Practice',
    description: 'Reach practice level 4',
    reputationBonus: 20,
  },
  {
    id: 'practice_level_5',
    name: 'Premier Practice',
    description: 'Reach the highest practice level',
    reputationBonus: 30,
  },
]

/**
 * Get milestone config by ID
 */
export function getMilestoneConfig(id: MilestoneId): MilestoneConfig | undefined {
  return MILESTONES.find((m) => m.id === id)
}

/**
 * Practice level configuration
 */
export interface PracticeLevelConfig {
  level: PracticeLevel
  name: string
  minReputation: number
  staffCap: number
  unlocks: string[]
}

export const PRACTICE_LEVELS: PracticeLevelConfig[] = [
  {
    level: 1,
    name: 'Starting Practice',
    minReputation: 0,
    staffCap: 1,
    unlocks: ['Solo practice', 'Basic scheduling'],
  },
  {
    level: 2,
    name: 'Established',
    minReputation: 50,
    staffCap: 2,
    unlocks: ['Hire 1st employee', 'Basic training programs'],
  },
  {
    level: 3,
    name: 'Growing',
    minReputation: 125,
    staffCap: 3,
    unlocks: ['Hire 2nd employee', 'Advanced training', 'Telehealth'],
  },
  {
    level: 4,
    name: 'Respected',
    minReputation: 250,
    staffCap: 4,
    unlocks: ['Premium insurance panels', 'Large office', 'Hire 3rd+ staff'],
  },
  {
    level: 5,
    name: 'Premier',
    minReputation: 400,
    staffCap: 5,
    unlocks: ['All features unlocked', 'Prestige bonuses'],
  },
]

/**
 * Get practice level from reputation
 */
export function getPracticeLevelFromReputation(reputation: number): PracticeLevel {
  for (let i = PRACTICE_LEVELS.length - 1; i >= 0; i--) {
    if (reputation >= PRACTICE_LEVELS[i].minReputation) {
      return PRACTICE_LEVELS[i].level
    }
  }
  return 1
}

/**
 * Get practice level config
 */
export function getPracticeLevelConfig(level: PracticeLevel): PracticeLevelConfig {
  return PRACTICE_LEVELS[level - 1]
}
