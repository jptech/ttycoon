import { describe, it, expect } from 'vitest'
import {
  EventManager,
  EVENT_CONFIG,
  type EventCooldowns,
  type EventContext,
  type SessionContext,
} from '@/core/events'
import type {
  RandomEvent,
  DecisionEvent,
  GameModifier,
  ConditionCategory,
  Session,
} from '@/core/types'

// ==================== TEST DATA ====================

const createRandomEvent = (overrides: Partial<RandomEvent> = {}): RandomEvent => ({
  id: 'test_event',
  title: 'Test Event',
  description: 'A test event',
  type: 'neutral',
  cooldownDays: 7,
  choices: [
    { text: 'Choice 1', effects: { money: 100, reputation: 2 } },
    { text: 'Choice 2', effects: { money: -50 } },
  ],
  ...overrides,
})

const createDecisionEvent = (overrides: Partial<DecisionEvent> = {}): DecisionEvent => ({
  id: 'test_decision',
  title: 'Test Decision',
  description: 'A test decision event',
  choices: [
    { text: 'Option A', effects: { quality: 0.1, energy: -5 } },
    { text: 'Option B', effects: { quality: -0.05, energy: 0 } },
  ],
  ...overrides,
})

const createModifier = (overrides: Partial<GameModifier> = {}): GameModifier => ({
  id: 'test_modifier',
  name: 'Test Modifier',
  effect: 'test_effect',
  startDay: 1,
  duration: 7,
  multiplier: 1.5,
  ...overrides,
})

const createEventContext = (overrides: Partial<EventContext> = {}): EventContext => ({
  currentDay: 10,
  reputation: 100,
  therapistCount: 2,
  playerEnergy: 80,
  ...overrides,
})

const createSessionContext = (overrides: Partial<SessionContext> = {}): SessionContext => ({
  clientSeverity: 5,
  clientConditionCategory: 'anxiety' as ConditionCategory,
  sessionProgress: 0.5,
  currentMinute: 25,
  gameSpeed: 1,
  ...overrides,
})

// ==================== RANDOM EVENT TRIGGERING ====================

describe('EventManager - Random Event Triggering', () => {
  it('should not trigger events before minimum day', () => {
    const events = [createRandomEvent()]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext({ currentDay: 1 })

    const result = EventManager.checkRandomEventTrigger(
      1,
      events,
      cooldowns,
      context,
      12345
    )

    expect(result.shouldTrigger).toBe(false)
    expect(result.event).toBeNull()
  })

  it('should trigger events after minimum day with correct seed', () => {
    const events = [createRandomEvent()]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext()

    // Find a seed that triggers an event
    let triggeredResult = null
    for (let seed = 1; seed < 1000; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      if (result.shouldTrigger) {
        triggeredResult = result
        break
      }
    }

    expect(triggeredResult).not.toBeNull()
    expect(triggeredResult!.event).toEqual(events[0])
  })

  it('should respect event cooldowns', () => {
    const events = [createRandomEvent({ id: 'cooled_event' })]
    const cooldowns: EventCooldowns = { cooled_event: 15 } // On cooldown until day 15
    const context = createEventContext({ currentDay: 10 })

    // Even with high attempts, should not trigger cooled event
    let triggered = false
    for (let seed = 1; seed < 100; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      if (result.shouldTrigger) {
        triggered = true
        break
      }
    }

    expect(triggered).toBe(false)
  })

  it('should filter events by reputation requirement', () => {
    const events = [
      createRandomEvent({ id: 'low_rep', conditions: { minReputation: 50 } }),
      createRandomEvent({ id: 'high_rep', conditions: { minReputation: 200 } }),
    ]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext({ reputation: 100 })

    // With rep 100, only low_rep should be eligible
    const foundEvents = new Set<string>()
    for (let seed = 1; seed < 500; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      if (result.shouldTrigger && result.event) {
        foundEvents.add(result.event.id)
      }
    }

    expect(foundEvents.has('low_rep')).toBe(true)
    expect(foundEvents.has('high_rep')).toBe(false)
  })

  it('should filter events by therapist count requirement', () => {
    const events = [
      createRandomEvent({ id: 'solo', conditions: { minTherapists: 1 } }),
      createRandomEvent({ id: 'team', conditions: { minTherapists: 3 } }),
    ]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext({ therapistCount: 2 })

    const foundEvents = new Set<string>()
    for (let seed = 1; seed < 500; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      if (result.shouldTrigger && result.event) {
        foundEvents.add(result.event.id)
      }
    }

    expect(foundEvents.has('solo')).toBe(true)
    expect(foundEvents.has('team')).toBe(false)
  })

  it('should filter events by minimum day requirement', () => {
    const events = [
      createRandomEvent({ id: 'early', conditions: { minDay: 5 } }),
      createRandomEvent({ id: 'late', conditions: { minDay: 30 } }),
    ]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext({ currentDay: 10 })

    const foundEvents = new Set<string>()
    for (let seed = 1; seed < 500; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      if (result.shouldTrigger && result.event) {
        foundEvents.add(result.event.id)
      }
    }

    expect(foundEvents.has('early')).toBe(true)
    expect(foundEvents.has('late')).toBe(false)
  })

  it('should return null event when no events are eligible', () => {
    const events = [
      createRandomEvent({ conditions: { minReputation: 1000 } }),
    ]
    const cooldowns: EventCooldowns = {}
    const context = createEventContext({ reputation: 50 })

    // Try many seeds
    for (let seed = 1; seed < 100; seed++) {
      const result = EventManager.checkRandomEventTrigger(
        10,
        events,
        cooldowns,
        context,
        seed
      )
      // Should never trigger since no events are eligible
      if (result.shouldTrigger) {
        expect(result.event).not.toBeNull()
      }
    }
  })
})

// ==================== DECISION EVENT TRIGGERING ====================

describe('EventManager - Decision Event Triggering', () => {
  it('should trigger decision events during sessions', () => {
    const events = [createDecisionEvent()]
    const usedEventIds: string[] = []
    const context = createSessionContext()

    let triggered = false
    for (let seed = 1; seed < 200; seed++) {
      const result = EventManager.checkDecisionEventTrigger(
        events,
        usedEventIds,
        context,
        seed
      )
      if (result.shouldTrigger) {
        triggered = true
        expect(result.event).toEqual(events[0])
        break
      }
    }

    expect(triggered).toBe(true)
  })

  it('should not repeat events already used in session', () => {
    const events = [createDecisionEvent({ id: 'used_event' })]
    const usedEventIds = ['used_event']
    const context = createSessionContext()

    // Should never trigger already-used event
    for (let seed = 1; seed < 100; seed++) {
      const result = EventManager.checkDecisionEventTrigger(
        events,
        usedEventIds,
        context,
        seed
      )
      expect(result.shouldTrigger).toBe(false)
    }
  })

  it('should filter events by severity requirement', () => {
    const events = [
      createDecisionEvent({ id: 'low_sev', triggerConditions: { minSeverity: 3 } }),
      createDecisionEvent({ id: 'high_sev', triggerConditions: { minSeverity: 8 } }),
    ]
    const usedEventIds: string[] = []
    const context = createSessionContext({ clientSeverity: 5 })

    const foundEvents = new Set<string>()
    for (let seed = 1; seed < 500; seed++) {
      const result = EventManager.checkDecisionEventTrigger(
        events,
        usedEventIds,
        context,
        seed
      )
      if (result.shouldTrigger && result.event) {
        foundEvents.add(result.event.id)
      }
    }

    expect(foundEvents.has('low_sev')).toBe(true)
    expect(foundEvents.has('high_sev')).toBe(false)
  })

  it('should filter events by condition category', () => {
    const events = [
      createDecisionEvent({ id: 'anxiety_event', triggerConditions: { conditionCategories: ['anxiety'] } }),
      createDecisionEvent({ id: 'trauma_event', triggerConditions: { conditionCategories: ['trauma'] } }),
    ]
    const usedEventIds: string[] = []
    const context = createSessionContext({ clientConditionCategory: 'anxiety' })

    const foundEvents = new Set<string>()
    for (let seed = 1; seed < 500; seed++) {
      const result = EventManager.checkDecisionEventTrigger(
        events,
        usedEventIds,
        context,
        seed
      )
      if (result.shouldTrigger && result.event) {
        foundEvents.add(result.event.id)
      }
    }

    expect(foundEvents.has('anxiety_event')).toBe(true)
    expect(foundEvents.has('trauma_event')).toBe(false)
  })

  it('should adjust trigger chance based on game speed', () => {
    // At higher speeds, trigger chance should be lower per check
    expect(EVENT_CONFIG.SPEED_MULTIPLIER_3X).toBeLessThan(EVENT_CONFIG.SPEED_MULTIPLIER_2X)
    expect(EVENT_CONFIG.SPEED_MULTIPLIER_2X).toBeLessThan(EVENT_CONFIG.SPEED_MULTIPLIER_1X)
  })
})

// ==================== APPLYING RANDOM EVENT EFFECTS ====================

describe('EventManager - Applying Random Event Effects', () => {
  it('should apply money and reputation effects', () => {
    const event = createRandomEvent({
      choices: [
        { text: 'Gain', effects: { money: 500, reputation: 5 } },
        { text: 'Lose', effects: { money: -200, reputation: -3 } },
      ],
    })

    const result = EventManager.applyRandomEventChoice(event, 0, 10)

    expect(result.moneyChange).toBe(500)
    expect(result.reputationChange).toBe(5)
    expect(result.playerEnergyChange).toBe(0)
    expect(result.cancelledSessionIds).toEqual([])
    expect(result.newClientSpawned).toBe(false)
  })

  it('should apply energy effects', () => {
    const event = createRandomEvent({
      choices: [{ text: 'Drain', effects: { playerEnergy: -20 } }],
    })

    const result = EventManager.applyRandomEventChoice(event, 0, 10)

    expect(result.playerEnergyChange).toBe(-20)
  })

  it('should handle session cancellation', () => {
    const event = createRandomEvent({
      choices: [{ text: 'Cancel', effects: { cancelTherapistSessions: true } }],
    })
    const sessionIds = ['session-1', 'session-2']

    const result = EventManager.applyRandomEventChoice(event, 0, 10, sessionIds)

    expect(result.cancelledSessionIds).toEqual(sessionIds)
  })

  it('should handle new client spawning', () => {
    const event = createRandomEvent({
      choices: [{ text: 'Accept', effects: { newClient: true } }],
    })

    const result = EventManager.applyRandomEventChoice(event, 0, 10)

    expect(result.newClientSpawned).toBe(true)
  })

  it('should create modifier with correct start day', () => {
    const event = createRandomEvent({
      choices: [{
        text: 'Boost',
        effects: {
          modifier: {
            id: 'boost',
            name: 'Reputation Boost',
            effect: 'reputation_gain',
            startDay: 0,
            duration: 5,
            multiplier: 1.5,
          },
        },
      }],
    })

    const result = EventManager.applyRandomEventChoice(event, 0, 15)

    expect(result.modifierApplied).not.toBeNull()
    expect(result.modifierApplied!.startDay).toBe(15)
    expect(result.modifierApplied!.duration).toBe(5)
    expect(result.modifierApplied!.multiplier).toBe(1.5)
  })

  it('should handle invalid choice index', () => {
    const event = createRandomEvent()

    const result = EventManager.applyRandomEventChoice(event, 99, 10)

    expect(result.moneyChange).toBe(0)
    expect(result.reputationChange).toBe(0)
  })
})

// ==================== APPLYING DECISION EVENT EFFECTS ====================

describe('EventManager - Applying Decision Event Effects', () => {
  it('should apply quality and energy effects', () => {
    const event = createDecisionEvent({
      choices: [
        { text: 'Deep', effects: { quality: 0.15, energy: -10 } },
        { text: 'Quick', effects: { quality: 0.05, energy: -2 } },
      ],
    })

    const result = EventManager.applyDecisionEventChoice(event, 0)

    expect(result.qualityChange).toBe(0.15)
    expect(result.energyChange).toBe(-10)
    expect(result.satisfactionChange).toBe(0)
  })

  it('should apply satisfaction effects', () => {
    const event = createDecisionEvent({
      choices: [{ text: 'Support', effects: { quality: 0.1, satisfaction: 15 } }],
    })

    const result = EventManager.applyDecisionEventChoice(event, 0)

    expect(result.satisfactionChange).toBe(15)
  })

  it('should handle invalid choice index', () => {
    const event = createDecisionEvent()

    const result = EventManager.applyDecisionEventChoice(event, 99)

    expect(result.qualityChange).toBe(0)
    expect(result.energyChange).toBe(0)
    expect(result.satisfactionChange).toBe(0)
  })
})

// ==================== COOLDOWN MANAGEMENT ====================

describe('EventManager - Cooldown Management', () => {
  it('should update cooldowns correctly', () => {
    const cooldowns: EventCooldowns = { existing: 20 }

    const updated = EventManager.updateCooldowns(cooldowns, 'new_event', 10, 7)

    expect(updated.new_event).toBe(17)
    expect(updated.existing).toBe(20)
  })

  it('should check if event is on cooldown', () => {
    const cooldowns: EventCooldowns = { event_a: 15 }

    expect(EventManager.isOnCooldown(cooldowns, 'event_a', 10)).toBe(true)
    expect(EventManager.isOnCooldown(cooldowns, 'event_a', 15)).toBe(false)
    expect(EventManager.isOnCooldown(cooldowns, 'event_a', 20)).toBe(false)
    expect(EventManager.isOnCooldown(cooldowns, 'event_b', 10)).toBe(false)
  })

  it('should get cooldown remaining days', () => {
    const cooldowns: EventCooldowns = { event_a: 15 }

    expect(EventManager.getCooldownRemaining(cooldowns, 'event_a', 10)).toBe(5)
    expect(EventManager.getCooldownRemaining(cooldowns, 'event_a', 15)).toBe(0)
    expect(EventManager.getCooldownRemaining(cooldowns, 'event_a', 20)).toBe(0)
    expect(EventManager.getCooldownRemaining(cooldowns, 'unknown', 10)).toBe(0)
  })

  it('should clean up expired cooldowns', () => {
    const cooldowns: EventCooldowns = {
      expired_1: 5,
      expired_2: 10,
      active: 20,
      future: 25,
    }

    const cleaned = EventManager.cleanupCooldowns(cooldowns, 15)

    expect(cleaned.expired_1).toBeUndefined()
    expect(cleaned.expired_2).toBeUndefined()
    expect(cleaned.active).toBe(20)
    expect(cleaned.future).toBe(25)
  })
})

// ==================== MODIFIER MANAGEMENT ====================

describe('EventManager - Modifier Management', () => {
  it('should check if modifier is active', () => {
    const modifier = createModifier({ startDay: 10, duration: 5 })

    expect(EventManager.isModifierActive(modifier, 9)).toBe(false)
    expect(EventManager.isModifierActive(modifier, 10)).toBe(true)
    expect(EventManager.isModifierActive(modifier, 12)).toBe(true)
    expect(EventManager.isModifierActive(modifier, 14)).toBe(true)
    expect(EventManager.isModifierActive(modifier, 15)).toBe(false)
    expect(EventManager.isModifierActive(modifier, 20)).toBe(false)
  })

  it('should get remaining days for modifier', () => {
    const modifier = createModifier({ startDay: 10, duration: 5 })

    expect(EventManager.getModifierRemainingDays(modifier, 10)).toBe(5)
    expect(EventManager.getModifierRemainingDays(modifier, 12)).toBe(3)
    expect(EventManager.getModifierRemainingDays(modifier, 15)).toBe(0)
    expect(EventManager.getModifierRemainingDays(modifier, 20)).toBe(0)
  })

  it('should filter active modifiers', () => {
    const modifiers = [
      createModifier({ id: 'expired', startDay: 1, duration: 5 }),
      createModifier({ id: 'active', startDay: 8, duration: 10 }),
      createModifier({ id: 'future', startDay: 20, duration: 5 }),
    ]

    const active = EventManager.getActiveModifiers(modifiers, 10)

    expect(active.length).toBe(1)
    expect(active[0].id).toBe('active')
  })

  it('should filter expired modifiers', () => {
    const modifiers = [
      createModifier({ id: 'expired', startDay: 1, duration: 5 }),
      createModifier({ id: 'active', startDay: 8, duration: 10 }),
    ]

    const expired = EventManager.getExpiredModifiers(modifiers, 10)

    expect(expired.length).toBe(1)
    expect(expired[0].id).toBe('expired')
  })

  it('should apply modifiers to values', () => {
    const modifiers = [
      createModifier({ id: 'm1', effect: 'reputation_gain', multiplier: 1.5 }),
      createModifier({ id: 'm2', effect: 'reputation_gain', multiplier: 1.2 }),
      createModifier({ id: 'm3', effect: 'other_effect', multiplier: 2.0 }),
    ]

    const result = EventManager.applyModifiers(100, modifiers, 'reputation_gain', 5)

    // 100 * 1.5 * 1.2 = 180
    expect(result).toBe(180)
  })

  it('should get total modifier multiplier', () => {
    const modifiers = [
      createModifier({ id: 'm1', effect: 'client_arrival', multiplier: 1.2 }),
      createModifier({ id: 'm2', effect: 'client_arrival', multiplier: 1.3 }),
    ]

    const multiplier = EventManager.getTotalModifierMultiplier(modifiers, 'client_arrival', 5)

    expect(multiplier).toBeCloseTo(1.56, 2) // 1.2 * 1.3
  })

  it('should return 1.0 multiplier when no matching modifiers', () => {
    const modifiers = [
      createModifier({ effect: 'other_effect' }),
    ]

    const multiplier = EventManager.getTotalModifierMultiplier(modifiers, 'nonexistent', 5)

    expect(multiplier).toBe(1.0)
  })

  it('should create a modifier', () => {
    const modifier = EventManager.createModifier(
      'new_mod',
      'New Modifier',
      'test_effect',
      10,
      7,
      1.25
    )

    expect(modifier.id).toBe('new_mod')
    expect(modifier.name).toBe('New Modifier')
    expect(modifier.effect).toBe('test_effect')
    expect(modifier.startDay).toBe(10)
    expect(modifier.duration).toBe(7)
    expect(modifier.multiplier).toBe(1.25)
  })
})

// ==================== EVENT UTILITIES ====================

describe('EventManager - Utilities', () => {
  it('should filter events by type', () => {
    const events = [
      createRandomEvent({ id: 'pos1', type: 'positive' }),
      createRandomEvent({ id: 'pos2', type: 'positive' }),
      createRandomEvent({ id: 'neg1', type: 'negative' }),
      createRandomEvent({ id: 'neu1', type: 'neutral' }),
    ]

    expect(EventManager.filterEventsByType(events, 'positive').length).toBe(2)
    expect(EventManager.filterEventsByType(events, 'negative').length).toBe(1)
    expect(EventManager.filterEventsByType(events, 'neutral').length).toBe(1)
  })

  it('should get event statistics', () => {
    const cooldowns: EventCooldowns = {
      event_1: 20,
      event_2: 25,
      event_3: 10, // expired
    }
    const modifiers = [
      createModifier({ id: 'm1', startDay: 10, duration: 10 }),
      createModifier({ id: 'm2', startDay: 5, duration: 3 }), // expired
      createModifier({ id: 'm3', startDay: 12, duration: 5 }),
    ]

    const stats = EventManager.getEventStats(cooldowns, modifiers, 15)

    expect(stats.activeModifiers).toBe(2)
    expect(stats.eventsOnCooldown).toBe(2)
    expect(stats.totalCooldownDays).toBe(15) // (20-15) + (25-15)
  })

  it('should check if should check for decision event', () => {
    const session = {
      id: 'session-1',
      status: 'in_progress' as const,
    } as Session

    expect(EventManager.shouldCheckForDecisionEvent(session, 24, 25)).toBe(true)
    expect(EventManager.shouldCheckForDecisionEvent(session, 25, 25)).toBe(false)
    expect(EventManager.shouldCheckForDecisionEvent(session, 26, 25)).toBe(false)

    const completedSession = { ...session, status: 'completed' as const }
    expect(EventManager.shouldCheckForDecisionEvent(completedSession, 24, 25)).toBe(false)
  })

  it('should calculate quality from decisions', () => {
    const decisions = [
      { effects: { quality: 0.1 } },
      { effects: { quality: 0.05 } },
      { effects: { quality: -0.02 } },
      { effects: { energy: -10 } }, // No quality effect
    ]

    const totalQuality = EventManager.calculateQualityFromDecisions(decisions)

    expect(totalQuality).toBeCloseTo(0.13, 5)
  })

  it('should get modifier summary', () => {
    const modifiers = [
      createModifier({
        id: 'm1',
        name: 'Boost',
        effect: 'reputation_gain',
        startDay: 10,
        duration: 5,
        multiplier: 1.5,
      }),
      createModifier({
        id: 'm2',
        name: 'Expired',
        effect: 'other',
        startDay: 1,
        duration: 5,
        multiplier: 2.0,
      }),
    ]

    const summary = EventManager.getModifierSummary(modifiers, 12)

    expect(summary.length).toBe(1)
    expect(summary[0].name).toBe('Boost')
    expect(summary[0].type).toBe('reputation_gain')
    expect(summary[0].multiplier).toBe(1.5)
    expect(summary[0].daysRemaining).toBe(3)
  })
})

// ==================== EVENT CONFIG ====================

describe('EVENT_CONFIG', () => {
  it('should have valid configuration values', () => {
    expect(EVENT_CONFIG.DAILY_EVENT_CHANCE).toBeGreaterThan(0)
    expect(EVENT_CONFIG.DAILY_EVENT_CHANCE).toBeLessThanOrEqual(1)

    expect(EVENT_CONFIG.MIN_DAY_FOR_EVENTS).toBeGreaterThanOrEqual(1)

    expect(EVENT_CONFIG.BASE_DECISION_CHANCE_PER_MINUTE).toBeGreaterThan(0)
    expect(EVENT_CONFIG.BASE_DECISION_CHANCE_PER_MINUTE).toBeLessThan(1)

    expect(EVENT_CONFIG.SPEED_MULTIPLIER_1X).toBe(1)
    expect(EVENT_CONFIG.SPEED_MULTIPLIER_2X).toBeLessThan(1)
    expect(EVENT_CONFIG.SPEED_MULTIPLIER_3X).toBeLessThan(EVENT_CONFIG.SPEED_MULTIPLIER_2X)

    expect(EVENT_CONFIG.MIN_COOLDOWN_DAYS).toBeGreaterThan(0)
    expect(EVENT_CONFIG.MAX_COOLDOWN_DAYS).toBeGreaterThan(EVENT_CONFIG.MIN_COOLDOWN_DAYS)
    expect(EVENT_CONFIG.DEFAULT_COOLDOWN_DAYS).toBeGreaterThanOrEqual(EVENT_CONFIG.MIN_COOLDOWN_DAYS)
    expect(EVENT_CONFIG.DEFAULT_COOLDOWN_DAYS).toBeLessThanOrEqual(EVENT_CONFIG.MAX_COOLDOWN_DAYS)
  })
})
