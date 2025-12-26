import type {
  RandomEvent,
  RandomEventChoice,
  RandomEventEffects,
  DecisionEvent,
  DecisionEventChoice,
  DecisionEffects,
  GameModifier,
  ConditionCategory,
  Session,
} from '@/core/types'
import { generateId } from '@/lib/utils'

/**
 * Create a seeded random number generator using mulberry32 algorithm.
 * This ensures deterministic random numbers for reproducible testing.
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Configuration for the events system
 */
export const EVENT_CONFIG = {
  // Random event triggering
  DAILY_EVENT_CHANCE: 0.3, // 30% chance per day
  MIN_DAY_FOR_EVENTS: 2, // No events on day 1

  // Decision event triggering during sessions
  BASE_DECISION_CHANCE_PER_MINUTE: 0.015, // 1.5% per minute
  SPEED_MULTIPLIER_1X: 1.0,
  SPEED_MULTIPLIER_2X: 0.75, // Slightly reduced at higher speeds
  SPEED_MULTIPLIER_3X: 0.5,

  // Guaranteed decision event thresholds
  FIRST_EVENT_WINDOW_START: 0.25, // First event can trigger from 25%
  FIRST_EVENT_WINDOW_END: 0.50, // First event random check ends at 50%
  GUARANTEED_EVENT_THRESHOLD: 0.65, // Force first event by 65% if none occurred
  SECOND_EVENT_WINDOW_START: 0.70, // Second event can trigger from 70%
  SECOND_EVENT_WINDOW_END: 0.90, // Second event window ends at 90%
  SECOND_EVENT_CHANCE: 0.35, // 35% chance for a second event

  // Cooldowns
  DEFAULT_COOLDOWN_DAYS: 7,
  MIN_COOLDOWN_DAYS: 3,
  MAX_COOLDOWN_DAYS: 14,

  // Modifier defaults
  DEFAULT_MODIFIER_DURATION: 7,
} as const

/**
 * Tracks which events are on cooldown
 */
export interface EventCooldowns {
  [eventId: string]: number // day when event can trigger again
}

/**
 * Result of checking if a random event should trigger
 */
export interface RandomEventCheck {
  shouldTrigger: boolean
  event: RandomEvent | null
}

/**
 * Result of checking if a decision event should trigger
 */
export interface DecisionEventCheck {
  shouldTrigger: boolean
  event: DecisionEvent | null
}

/**
 * Result of applying random event effects
 */
export interface RandomEventResult {
  moneyChange: number
  reputationChange: number
  playerEnergyChange: number
  cancelledSessionIds: string[]
  newClientSpawned: boolean
  modifierApplied: GameModifier | null
}

/**
 * Result of applying decision event effects
 */
export interface DecisionEventResult {
  qualityChange: number
  energyChange: number
  satisfactionChange: number
}

/**
 * Context for evaluating event conditions
 */
export interface EventContext {
  currentDay: number
  reputation: number
  therapistCount: number
  playerEnergy: number
}

/**
 * Session context for decision events
 */
export interface SessionContext {
  clientSeverity: number
  clientConditionCategory: ConditionCategory
  sessionProgress: number
  currentMinute: number
  gameSpeed: 1 | 2 | 3
}

/**
 * Pure functions for managing game events
 */
export const EventManager = {
  /**
   * Check if a random event should trigger at the start of day
   */
  checkRandomEventTrigger(
    currentDay: number,
    availableEvents: RandomEvent[],
    cooldowns: EventCooldowns,
    context: EventContext,
    seed?: number
  ): RandomEventCheck {
    // No events on early days
    if (currentDay < EVENT_CONFIG.MIN_DAY_FOR_EVENTS) {
      return { shouldTrigger: false, event: null }
    }

    // Roll for event trigger
    const random = seededRandom(seed ?? Date.now())
    if (random() > EVENT_CONFIG.DAILY_EVENT_CHANCE) {
      return { shouldTrigger: false, event: null }
    }

    // Get eligible events (not on cooldown and conditions met)
    const eligibleEvents = availableEvents.filter((event) => {
      // Check cooldown
      const cooldownEnds = cooldowns[event.id] ?? 0
      if (currentDay < cooldownEnds) {
        return false
      }

      // Check conditions
      if (event.conditions) {
        if (event.conditions.minReputation !== undefined) {
          if (context.reputation < event.conditions.minReputation) {
            return false
          }
        }
        if (event.conditions.minTherapists !== undefined) {
          if (context.therapistCount < event.conditions.minTherapists) {
            return false
          }
        }
        if (event.conditions.minDay !== undefined) {
          if (currentDay < event.conditions.minDay) {
            return false
          }
        }
      }

      return true
    })

    if (eligibleEvents.length === 0) {
      return { shouldTrigger: false, event: null }
    }

    // Randomly select one eligible event
    const selectedIndex = Math.floor(random() * eligibleEvents.length)
    return {
      shouldTrigger: true,
      event: eligibleEvents[selectedIndex],
    }
  },

  /**
   * Check if a decision event should trigger during a session
   */
  checkDecisionEventTrigger(
    availableEvents: DecisionEvent[],
    usedEventIds: string[],
    sessionContext: SessionContext,
    seed?: number
  ): DecisionEventCheck {
    // Calculate trigger chance based on game speed
    let speedMultiplier: number
    switch (sessionContext.gameSpeed) {
      case 1:
        speedMultiplier = EVENT_CONFIG.SPEED_MULTIPLIER_1X
        break
      case 2:
        speedMultiplier = EVENT_CONFIG.SPEED_MULTIPLIER_2X
        break
      case 3:
        speedMultiplier = EVENT_CONFIG.SPEED_MULTIPLIER_3X
        break
      default:
        speedMultiplier = EVENT_CONFIG.SPEED_MULTIPLIER_1X
    }

    const triggerChance = EVENT_CONFIG.BASE_DECISION_CHANCE_PER_MINUTE * speedMultiplier

    const random = seededRandom(seed ?? Date.now())
    if (random() > triggerChance) {
      return { shouldTrigger: false, event: null }
    }

    // Get eligible events (not already used in this session and conditions met)
    const eligibleEvents = availableEvents.filter((event) => {
      // Don't repeat events in same session
      if (usedEventIds.includes(event.id)) {
        return false
      }

      // Check trigger conditions
      if (event.triggerConditions) {
        if (event.triggerConditions.minSeverity !== undefined) {
          if (sessionContext.clientSeverity < event.triggerConditions.minSeverity) {
            return false
          }
        }
        if (event.triggerConditions.conditionCategories !== undefined) {
          if (
            !event.triggerConditions.conditionCategories.includes(
              sessionContext.clientConditionCategory
            )
          ) {
            return false
          }
        }
      }

      return true
    })

    if (eligibleEvents.length === 0) {
      return { shouldTrigger: false, event: null }
    }

    // Randomly select one eligible event
    const selectedIndex = Math.floor(random() * eligibleEvents.length)
    return {
      shouldTrigger: true,
      event: eligibleEvents[selectedIndex],
    }
  },

  /**
   * Select a guaranteed decision event (bypasses random chance).
   * Used to ensure at least one decision event per session.
   */
  selectGuaranteedDecisionEvent(
    availableEvents: DecisionEvent[],
    usedEventIds: string[],
    sessionContext: SessionContext,
    seed?: number
  ): DecisionEvent | null {
    // Get eligible events (not already used in this session and conditions met)
    const eligibleEvents = availableEvents.filter((event) => {
      // Don't repeat events in same session
      if (usedEventIds.includes(event.id)) {
        return false
      }

      // Check trigger conditions
      if (event.triggerConditions) {
        if (event.triggerConditions.minSeverity !== undefined) {
          if (sessionContext.clientSeverity < event.triggerConditions.minSeverity) {
            return false
          }
        }
        if (event.triggerConditions.conditionCategories !== undefined) {
          if (
            !event.triggerConditions.conditionCategories.includes(
              sessionContext.clientConditionCategory
            )
          ) {
            return false
          }
        }
      }

      return true
    })

    if (eligibleEvents.length === 0) {
      return null
    }

    // Randomly select one eligible event
    const random = seededRandom(seed ?? Date.now())
    const selectedIndex = Math.floor(random() * eligibleEvents.length)
    return eligibleEvents[selectedIndex]
  },

  /**
   * Check if a second decision event should trigger (optional, lower chance).
   * Only triggers if one event has already occurred.
   */
  checkSecondDecisionEventTrigger(
    availableEvents: DecisionEvent[],
    usedEventIds: string[],
    sessionContext: SessionContext,
    seed?: number
  ): DecisionEventCheck {
    // Must have at least one event already
    if (usedEventIds.length === 0) {
      return { shouldTrigger: false, event: null }
    }

    // Check if random roll passes
    const random = seededRandom(seed ?? Date.now())
    if (random() > EVENT_CONFIG.SECOND_EVENT_CHANCE) {
      return { shouldTrigger: false, event: null }
    }

    // Select an event
    const event = this.selectGuaranteedDecisionEvent(
      availableEvents,
      usedEventIds,
      sessionContext,
      seed ? seed + 1 : undefined
    )

    return {
      shouldTrigger: event !== null,
      event,
    }
  },

  /**
   * Apply the effects of a random event choice
   */
  applyRandomEventChoice(
    event: RandomEvent,
    choiceIndex: number,
    currentDay: number,
    therapistSessionIds: string[] = []
  ): RandomEventResult {
    const choice: RandomEventChoice | undefined = event.choices[choiceIndex]
    if (!choice) {
      return {
        moneyChange: 0,
        reputationChange: 0,
        playerEnergyChange: 0,
        cancelledSessionIds: [],
        newClientSpawned: false,
        modifierApplied: null,
      }
    }

    const effects: RandomEventEffects = choice.effects

    const result: RandomEventResult = {
      moneyChange: effects.money ?? 0,
      reputationChange: effects.reputation ?? 0,
      playerEnergyChange: effects.playerEnergy ?? 0,
      cancelledSessionIds: effects.cancelTherapistSessions ? [...therapistSessionIds] : [],
      newClientSpawned: effects.newClient ?? false,
      modifierApplied: null,
    }

    // Create modifier if specified
    if (effects.modifier) {
      result.modifierApplied = {
        ...effects.modifier,
        id: effects.modifier.id || generateId(),
        startDay: currentDay,
      }
    }

    return result
  },

  /**
   * Apply the effects of a decision event choice
   */
  applyDecisionEventChoice(
    event: DecisionEvent,
    choiceIndex: number
  ): DecisionEventResult {
    const choice: DecisionEventChoice | undefined = event.choices[choiceIndex]
    if (!choice) {
      return {
        qualityChange: 0,
        energyChange: 0,
        satisfactionChange: 0,
      }
    }

    const effects: DecisionEffects = choice.effects

    return {
      qualityChange: effects.quality ?? 0,
      energyChange: effects.energy ?? 0,
      satisfactionChange: effects.satisfaction ?? 0,
    }
  },

  /**
   * Update cooldowns after a random event triggers
   */
  updateCooldowns(
    cooldowns: EventCooldowns,
    eventId: string,
    currentDay: number,
    cooldownDays: number
  ): EventCooldowns {
    return {
      ...cooldowns,
      [eventId]: currentDay + cooldownDays,
    }
  },

  /**
   * Check if an event is on cooldown
   */
  isOnCooldown(cooldowns: EventCooldowns, eventId: string, currentDay: number): boolean {
    const cooldownEnds = cooldowns[eventId] ?? 0
    return currentDay < cooldownEnds
  },

  /**
   * Get days remaining on a cooldown
   */
  getCooldownRemaining(
    cooldowns: EventCooldowns,
    eventId: string,
    currentDay: number
  ): number {
    const cooldownEnds = cooldowns[eventId] ?? 0
    return Math.max(0, cooldownEnds - currentDay)
  },

  /**
   * Clean up expired cooldowns
   */
  cleanupCooldowns(cooldowns: EventCooldowns, currentDay: number): EventCooldowns {
    const cleaned: EventCooldowns = {}
    for (const [eventId, expiresDay] of Object.entries(cooldowns)) {
      if (expiresDay > currentDay) {
        cleaned[eventId] = expiresDay
      }
    }
    return cleaned
  },

  /**
   * Check if a modifier is still active
   */
  isModifierActive(modifier: GameModifier, currentDay: number): boolean {
    const endDay = modifier.startDay + modifier.duration
    return currentDay >= modifier.startDay && currentDay < endDay
  },

  /**
   * Get remaining days for a modifier
   */
  getModifierRemainingDays(modifier: GameModifier, currentDay: number): number {
    const endDay = modifier.startDay + modifier.duration
    return Math.max(0, endDay - currentDay)
  },

  /**
   * Filter active modifiers from a list
   */
  getActiveModifiers(modifiers: GameModifier[], currentDay: number): GameModifier[] {
    return modifiers.filter((modifier) => this.isModifierActive(modifier, currentDay))
  },

  /**
   * Get expired modifiers from a list
   */
  getExpiredModifiers(modifiers: GameModifier[], currentDay: number): GameModifier[] {
    return modifiers.filter((modifier) => !this.isModifierActive(modifier, currentDay))
  },

  /**
   * Apply modifiers to a value
   */
  applyModifiers(
    baseValue: number,
    modifiers: GameModifier[],
    effectType: string,
    currentDay: number
  ): number {
    const activeModifiers = this.getActiveModifiers(modifiers, currentDay)
    let value = baseValue

    for (const modifier of activeModifiers) {
      if (modifier.effect === effectType) {
        value *= modifier.multiplier
      }
    }

    return value
  },

  /**
   * Calculate the total modifier effect for a specific type
   */
  getTotalModifierMultiplier(
    modifiers: GameModifier[],
    effectType: string,
    currentDay: number
  ): number {
    const activeModifiers = this.getActiveModifiers(modifiers, currentDay)
    let multiplier = 1.0

    for (const modifier of activeModifiers) {
      if (modifier.effect === effectType) {
        multiplier *= modifier.multiplier
      }
    }

    return multiplier
  },

  /**
   * Create a modifier from event effects
   */
  createModifier(
    id: string,
    name: string,
    effect: string,
    startDay: number,
    duration: number,
    multiplier: number
  ): GameModifier {
    return {
      id,
      name,
      effect,
      startDay,
      duration,
      multiplier,
    }
  },

  /**
   * Get events by type
   */
  filterEventsByType(
    events: RandomEvent[],
    type: 'positive' | 'negative' | 'neutral'
  ): RandomEvent[] {
    return events.filter((event) => event.type === type)
  },

  /**
   * Get event statistics
   */
  getEventStats(
    cooldowns: EventCooldowns,
    modifiers: GameModifier[],
    currentDay: number
  ): {
    activeModifiers: number
    eventsOnCooldown: number
    totalCooldownDays: number
  } {
    const activeModifiers = this.getActiveModifiers(modifiers, currentDay).length

    const cooldownEntries = Object.entries(cooldowns).filter(
      ([, expiresDay]) => expiresDay > currentDay
    )
    const eventsOnCooldown = cooldownEntries.length

    const totalCooldownDays = cooldownEntries.reduce((sum, [, expiresDay]) => {
      return sum + (expiresDay - currentDay)
    }, 0)

    return {
      activeModifiers,
      eventsOnCooldown,
      totalCooldownDays,
    }
  },

  /**
   * Determine if a session should trigger a decision event based on accumulated time
   * This is used for checking once per minute tick
   */
  shouldCheckForDecisionEvent(
    session: Session,
    lastCheckMinute: number,
    currentMinute: number
  ): boolean {
    // Only check once per minute
    return currentMinute > lastCheckMinute && session.status === 'in_progress'
  },

  /**
   * Calculate quality impact from decision events
   */
  calculateQualityFromDecisions(decisions: { effects: DecisionEffects }[]): number {
    return decisions.reduce((sum, decision) => {
      return sum + (decision.effects.quality ?? 0)
    }, 0)
  },

  /**
   * Get a summary of modifier effects for display
   */
  getModifierSummary(
    modifiers: GameModifier[],
    currentDay: number
  ): { type: string; name: string; multiplier: number; daysRemaining: number }[] {
    return this.getActiveModifiers(modifiers, currentDay).map((modifier) => ({
      type: modifier.effect,
      name: modifier.name,
      multiplier: modifier.multiplier,
      daysRemaining: this.getModifierRemainingDays(modifier, currentDay),
    }))
  },
}
