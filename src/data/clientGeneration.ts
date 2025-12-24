import type { ConditionCategory, TimePreference, SessionFrequency } from '@/core/types'

/**
 * Weights for condition category generation
 * Higher weight = more likely to appear
 */
export const CONDITION_WEIGHTS: Record<ConditionCategory, number> = {
  anxiety: 25,
  depression: 20,
  stress: 20,
  relationship: 15,
  trauma: 10,
  behavioral: 10,
}

/**
 * Get a weighted random condition category
 */
export function getWeightedConditionCategory(random: () => number = Math.random): ConditionCategory {
  const totalWeight = Object.values(CONDITION_WEIGHTS).reduce((sum, w) => sum + w, 0)
  let roll = random() * totalWeight

  for (const [category, weight] of Object.entries(CONDITION_WEIGHTS)) {
    roll -= weight
    if (roll <= 0) {
      return category as ConditionCategory
    }
  }

  return 'anxiety' // Fallback
}

/**
 * Weights for time preference generation
 */
export const TIME_PREFERENCE_WEIGHTS: Record<TimePreference, number> = {
  morning: 20,
  afternoon: 35,
  evening: 25,
  any: 20,
}

/**
 * Get a weighted random time preference
 */
export function getWeightedTimePreference(random: () => number = Math.random): TimePreference {
  const totalWeight = Object.values(TIME_PREFERENCE_WEIGHTS).reduce((sum, w) => sum + w, 0)
  let roll = random() * totalWeight

  for (const [pref, weight] of Object.entries(TIME_PREFERENCE_WEIGHTS)) {
    roll -= weight
    if (roll <= 0) {
      return pref as TimePreference
    }
  }

  return 'any'
}

/**
 * Frequency preferences by condition category
 * Some conditions benefit from more frequent sessions
 */
export const FREQUENCY_BY_CONDITION: Record<ConditionCategory, SessionFrequency[]> = {
  anxiety: ['weekly', 'weekly', 'biweekly'],
  depression: ['weekly', 'weekly', 'weekly', 'biweekly'],
  trauma: ['weekly', 'weekly', 'biweekly'],
  stress: ['weekly', 'biweekly', 'biweekly'],
  relationship: ['weekly', 'biweekly'],
  behavioral: ['weekly', 'weekly', 'weekly'],
}

/**
 * Get frequency preference based on condition
 */
export function getFrequencyForCondition(
  category: ConditionCategory,
  random: () => number = Math.random
): SessionFrequency {
  const options = FREQUENCY_BY_CONDITION[category]
  return options[Math.floor(random() * options.length)]
}

/**
 * Session rate ranges by payment type
 */
export const SESSION_RATES = {
  privatePay: {
    min: 120,
    max: 200,
  },
  insurance: {
    min: 80,
    max: 150,
  },
}

/**
 * Get session rate based on payment type
 */
export function getSessionRate(isPrivatePay: boolean, random: () => number = Math.random): number {
  const range = isPrivatePay ? SESSION_RATES.privatePay : SESSION_RATES.insurance
  return Math.round(range.min + random() * (range.max - range.min))
}

/**
 * Client intake reasons (for display purposes)
 */
export const INTAKE_REASONS: Record<ConditionCategory, string[]> = {
  anxiety: [
    'Constant worry affecting daily life',
    'Panic attacks becoming more frequent',
    'Social situations feel overwhelming',
    'Can\'t stop anxious thoughts',
    'Physical symptoms of anxiety',
  ],
  depression: [
    'Feeling hopeless and stuck',
    'Lost interest in things I used to enjoy',
    'Struggling to get out of bed',
    'Persistent sadness for months',
    'Need help processing grief',
  ],
  trauma: [
    'Flashbacks and nightmares',
    'Past experiences affecting current life',
    'Need to process a traumatic event',
    'Childhood experiences still haunting me',
    'Struggling with trust after trauma',
  ],
  stress: [
    'Work stress is overwhelming',
    'Major life transition',
    'Burnout from caregiving',
    'Can\'t seem to relax anymore',
    'Stress affecting my health',
  ],
  relationship: [
    'Communication problems with partner',
    'Going through a difficult divorce',
    'Family conflict needs mediation',
    'Want to improve our relationship',
    'Trust issues with partner',
  ],
  behavioral: [
    'Anger is affecting relationships',
    'Need help with impulse control',
    'Recovery from addiction',
    'Struggling with eating habits',
    'Want to change destructive patterns',
  ],
}

/**
 * Get a random intake reason for condition
 */
export function getIntakeReason(category: ConditionCategory, random: () => number = Math.random): string {
  const reasons = INTAKE_REASONS[category]
  return reasons[Math.floor(random() * reasons.length)]
}

/**
 * Client generation chance by game day
 * Early game has fewer clients, ramps up over time
 */
export function getClientSpawnChance(currentDay: number, reputation: number): number {
  // Base chance increases with day (more established practice)
  const dayBonus = Math.min(0.3, currentDay * 0.01)

  // Reputation significantly affects client flow
  const reputationBonus = reputation * 0.002

  // Base 20% chance + bonuses, capped at 80%
  return Math.min(0.8, 0.2 + dayBonus + reputationBonus)
}

/**
 * Number of potential new clients per day (for checking)
 */
export function getClientSpawnAttempts(currentDay: number): number {
  // Start with 1-2 attempts, grow to 3-4 as practice establishes
  if (currentDay < 10) return 1
  if (currentDay < 30) return 2
  if (currentDay < 60) return 3
  return 4
}
