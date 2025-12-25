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

  // Insurance
  activePanels: InsurerId[]

  // Events
  eventCooldowns: Record<string, number> // eventId -> day when cooldown expires
  activeModifiers: GameModifier[]
  rememberedDecisions: Record<string, number> // eventId -> choiceIndex

  // Settings
  autoResolveSessions: boolean
  soundEnabled: boolean
  musicEnabled: boolean
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
    unlocks: ['Base gameplay (solo only)'],
  },
  {
    level: 2,
    name: 'Established',
    minReputation: 50,
    staffCap: 2,
    unlocks: ['Hiring', 'Training'],
  },
  {
    level: 3,
    name: 'Growing',
    minReputation: 125,
    staffCap: 3,
    unlocks: ['Better hiring pool', 'More training options'],
  },
  {
    level: 4,
    name: 'Respected',
    minReputation: 250,
    staffCap: 4,
    unlocks: ['Large office access', 'Premium insurance panels'],
  },
  {
    level: 5,
    name: 'Premier',
    minReputation: 400,
    staffCap: 5,
    unlocks: ['All features unlocked', 'Unlimited staff'],
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
