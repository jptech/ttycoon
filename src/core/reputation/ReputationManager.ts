/**
 * Pure reputation calculation functions
 */
import { PRACTICE_LEVELS, type PracticeLevel } from '@/core/types/state'

export const REPUTATION_CONFIG = {
  // Session quality tiers
  SESSION_EXCELLENT: 5,      // quality >= 0.80
  SESSION_GOOD: 2,           // quality >= 0.65
  SESSION_FAIR: 0,           // quality >= 0.50
  SESSION_POOR: -2,          // quality >= 0.30
  SESSION_VERY_POOR: -5,     // quality < 0.30

  // Client outcomes
  CLIENT_CURED_BONUS: 5,     // Successfully completed treatment
  CLIENT_DROPOUT_PENALTY: -3, // Client discontinued

  // Training
  TRAINING_COMPLETION_BONUS: 2, // Completing a program
} as const

/**
 * Calculate reputation change based on session quality
 */
export function getSessionReputationDelta(quality: number): number {
  if (quality >= 0.8) return REPUTATION_CONFIG.SESSION_EXCELLENT
  if (quality >= 0.65) return REPUTATION_CONFIG.SESSION_GOOD
  if (quality >= 0.5) return REPUTATION_CONFIG.SESSION_FAIR
  if (quality >= 0.3) return REPUTATION_CONFIG.SESSION_POOR
  return REPUTATION_CONFIG.SESSION_VERY_POOR
}

/**
 * Get descriptive text for reputation change
 */
export function getReputationChangeReason(quality: number): string {
  if (quality >= 0.8) return 'Excellent session'
  if (quality >= 0.65) return 'Good session'
  if (quality >= 0.5) return 'Fair session'
  if (quality >= 0.3) return 'Poor session quality'
  return 'Very poor session'
}

/**
 * Format reputation display value
 */
export function formatReputation(value: number): string {
  return Math.floor(value).toString()
}

/**
 * Get reputation display info for UI
 */
export interface ReputationDisplay {
  current: number
  level: PracticeLevel
  levelName: string
  minForLevel: number
  nextLevelThreshold: number | null
  progressToNext: number
  progressPercent: number
}

export function getReputationDisplay(reputation: number): ReputationDisplay {
  // Find current level
  let currentLevel: PracticeLevel = 1
  for (let i = PRACTICE_LEVELS.length - 1; i >= 0; i--) {
    if (reputation >= PRACTICE_LEVELS[i].minReputation) {
      currentLevel = PRACTICE_LEVELS[i].level
      break
    }
  }

  const currentLevelConfig = PRACTICE_LEVELS[currentLevel - 1]
  const nextLevelConfig = PRACTICE_LEVELS[currentLevel] // Will be undefined if at max level

  const minForLevel = currentLevelConfig.minReputation
  const nextLevelThreshold = nextLevelConfig?.minReputation ?? null

  let progressToNext = 0
  let progressPercent = 0

  if (nextLevelThreshold) {
    progressToNext = reputation - minForLevel
    const totalNeeded = nextLevelThreshold - minForLevel
    progressPercent = Math.min(100, Math.round((progressToNext / totalNeeded) * 100))
  } else {
    // At max level
    progressPercent = 100
  }

  return {
    current: reputation,
    level: currentLevel,
    levelName: currentLevelConfig.name,
    minForLevel,
    nextLevelThreshold,
    progressToNext,
    progressPercent,
  }
}

