/**
 * Tests for the guaranteed decision event system.
 *
 * These tests verify:
 * 1. EVENT_CONFIG constants for session progress windows
 * 2. selectGuaranteedDecisionEvent bypasses random chance
 * 3. checkSecondDecisionEventTrigger only fires after first event
 * 4. Second event has 35% chance
 */

import { describe, it, expect } from 'vitest'
import { EventManager, EVENT_CONFIG } from '@/core/events'
import type { DecisionEvent, ConditionCategory } from '@/core/types'

// Helper to create decision events
function createDecisionEvent(
  overrides: Partial<DecisionEvent> & { id: string }
): DecisionEvent {
  return {
    title: 'Test Event',
    description: 'Test description',
    choices: [
      { text: 'Choice A', effects: { quality: 0.1 } },
      { text: 'Choice B', effects: { quality: -0.1 } },
    ],
    ...overrides,
  }
}

// Helper to create session context
function createSessionContext(overrides: Partial<{
  clientSeverity: number
  clientConditionCategory: ConditionCategory
  sessionProgress: number
  currentMinute: number
  gameSpeed: 1 | 2 | 3
}> = {}) {
  return {
    clientSeverity: 5,
    clientConditionCategory: 'anxiety' as ConditionCategory,
    sessionProgress: 0.5,
    currentMinute: 25,
    gameSpeed: 1 as const,
    ...overrides,
  }
}

describe('EVENT_CONFIG decision event thresholds', () => {
  it('defines first event window from 25% to 50%', () => {
    expect(EVENT_CONFIG.FIRST_EVENT_WINDOW_START).toBe(0.25)
    expect(EVENT_CONFIG.FIRST_EVENT_WINDOW_END).toBe(0.50)
  })

  it('defines guaranteed event threshold at 65%', () => {
    expect(EVENT_CONFIG.GUARANTEED_EVENT_THRESHOLD).toBe(0.65)
  })

  it('defines second event window from 70% to 90%', () => {
    expect(EVENT_CONFIG.SECOND_EVENT_WINDOW_START).toBe(0.70)
    expect(EVENT_CONFIG.SECOND_EVENT_WINDOW_END).toBe(0.90)
  })

  it('defines second event chance at 35%', () => {
    expect(EVENT_CONFIG.SECOND_EVENT_CHANCE).toBe(0.35)
  })

  it('has non-overlapping windows in correct order', () => {
    // First window ends before guaranteed threshold
    expect(EVENT_CONFIG.FIRST_EVENT_WINDOW_END).toBeLessThanOrEqual(
      EVENT_CONFIG.GUARANTEED_EVENT_THRESHOLD
    )
    // Guaranteed threshold is before second window
    expect(EVENT_CONFIG.GUARANTEED_EVENT_THRESHOLD).toBeLessThanOrEqual(
      EVENT_CONFIG.SECOND_EVENT_WINDOW_START
    )
    // Second window ends before session ends
    expect(EVENT_CONFIG.SECOND_EVENT_WINDOW_END).toBeLessThanOrEqual(1.0)
  })
})

describe('EventManager.selectGuaranteedDecisionEvent', () => {
  it('returns an event when eligible events exist', () => {
    const events = [
      createDecisionEvent({ id: 'event_1' }),
      createDecisionEvent({ id: 'event_2' }),
    ]
    const context = createSessionContext()

    const event = EventManager.selectGuaranteedDecisionEvent(
      events,
      [],
      context,
      12345
    )

    expect(event).not.toBeNull()
    expect(['event_1', 'event_2']).toContain(event!.id)
  })

  it('returns null when no eligible events exist', () => {
    const events: DecisionEvent[] = []
    const context = createSessionContext()

    const event = EventManager.selectGuaranteedDecisionEvent(
      events,
      [],
      context,
      12345
    )

    expect(event).toBeNull()
  })

  it('excludes already used events', () => {
    const events = [
      createDecisionEvent({ id: 'used_event' }),
      createDecisionEvent({ id: 'available_event' }),
    ]
    const context = createSessionContext()

    const event = EventManager.selectGuaranteedDecisionEvent(
      events,
      ['used_event'],
      context,
      12345
    )

    expect(event).not.toBeNull()
    expect(event!.id).toBe('available_event')
  })

  it('returns null when all events are already used', () => {
    const events = [
      createDecisionEvent({ id: 'event_1' }),
      createDecisionEvent({ id: 'event_2' }),
    ]
    const context = createSessionContext()

    const event = EventManager.selectGuaranteedDecisionEvent(
      events,
      ['event_1', 'event_2'],
      context,
      12345
    )

    expect(event).toBeNull()
  })

  it('respects trigger conditions', () => {
    const events = [
      createDecisionEvent({
        id: 'high_severity_only',
        triggerConditions: { minSeverity: 8 },
      }),
    ]
    const context = createSessionContext({ clientSeverity: 5 })

    const event = EventManager.selectGuaranteedDecisionEvent(
      events,
      [],
      context,
      12345
    )

    expect(event).toBeNull()
  })

  it('is deterministic with same seed', () => {
    const events = [
      createDecisionEvent({ id: 'event_1' }),
      createDecisionEvent({ id: 'event_2' }),
      createDecisionEvent({ id: 'event_3' }),
    ]
    const context = createSessionContext()

    const event1 = EventManager.selectGuaranteedDecisionEvent(events, [], context, 42)
    const event2 = EventManager.selectGuaranteedDecisionEvent(events, [], context, 42)

    expect(event1!.id).toBe(event2!.id)
  })
})

describe('EventManager.checkSecondDecisionEventTrigger', () => {
  it('returns shouldTrigger=false when no events have occurred yet', () => {
    const events = [createDecisionEvent({ id: 'event_1' })]
    const context = createSessionContext()

    const result = EventManager.checkSecondDecisionEventTrigger(
      events,
      [], // No used events = no first event occurred
      context,
      12345
    )

    expect(result.shouldTrigger).toBe(false)
    expect(result.event).toBeNull()
  })

  it('can trigger when one event has already occurred', () => {
    const events = [
      createDecisionEvent({ id: 'first_event' }),
      createDecisionEvent({ id: 'second_event' }),
    ]
    const context = createSessionContext()

    // Run multiple times to test randomness
    let triggered = false
    for (let i = 0; i < 100; i++) {
      const result = EventManager.checkSecondDecisionEventTrigger(
        events,
        ['first_event'], // One event already used
        context,
        Date.now() + i
      )
      if (result.shouldTrigger) {
        triggered = true
        expect(result.event).not.toBeNull()
        expect(result.event!.id).toBe('second_event')
      }
    }

    // With 35% chance over 100 iterations, should trigger at least once
    expect(triggered).toBe(true)
  })

  it('respects 35% trigger chance', () => {
    const events = [
      createDecisionEvent({ id: 'second_event' }),
    ]
    const context = createSessionContext()

    let triggerCount = 0
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      const result = EventManager.checkSecondDecisionEventTrigger(
        events,
        ['first_event'],
        context,
        i * 1000 // Vary seed
      )
      if (result.shouldTrigger) {
        triggerCount++
      }
    }

    const actualRate = triggerCount / iterations
    // Should be approximately 35% (±10% tolerance for randomness)
    expect(actualRate).toBeGreaterThan(0.25)
    expect(actualRate).toBeLessThan(0.45)
  })

  it('excludes already used events from selection', () => {
    const events = [
      createDecisionEvent({ id: 'first_event' }),
      createDecisionEvent({ id: 'second_event' }),
    ]
    const context = createSessionContext()

    // Even if triggered, should only return second_event
    for (let i = 0; i < 50; i++) {
      const result = EventManager.checkSecondDecisionEventTrigger(
        events,
        ['first_event'],
        context,
        i
      )
      if (result.shouldTrigger && result.event) {
        expect(result.event.id).toBe('second_event')
      }
    }
  })

  it('returns null event when all events are used', () => {
    const events = [
      createDecisionEvent({ id: 'first_event' }),
    ]
    const context = createSessionContext()

    const result = EventManager.checkSecondDecisionEventTrigger(
      events,
      ['first_event'], // All events used
      context,
      12345
    )

    // Even if chance triggers, no event available
    expect(result.event).toBeNull()
    expect(result.shouldTrigger).toBe(false)
  })
})

describe('Three-phase event system integration', () => {
  it('Phase 1: can trigger in 25%-50% window', () => {
    const progress = 0.35 // In window
    expect(progress >= EVENT_CONFIG.FIRST_EVENT_WINDOW_START).toBe(true)
    expect(progress < EVENT_CONFIG.FIRST_EVENT_WINDOW_END).toBe(true)
  })

  it('Phase 1: cannot trigger outside window', () => {
    expect(0.20 >= EVENT_CONFIG.FIRST_EVENT_WINDOW_START).toBe(false)
    expect(0.55 < EVENT_CONFIG.FIRST_EVENT_WINDOW_END).toBe(false)
  })

  it('Phase 2: guaranteed at 65% threshold', () => {
    const progress = 0.66 // Past threshold
    expect(progress >= EVENT_CONFIG.GUARANTEED_EVENT_THRESHOLD).toBe(true)
    expect(progress < EVENT_CONFIG.SECOND_EVENT_WINDOW_START).toBe(true)
  })

  it('Phase 3: second event window is 70%-90%', () => {
    const progress = 0.80 // In window
    expect(progress >= EVENT_CONFIG.SECOND_EVENT_WINDOW_START).toBe(true)
    expect(progress < EVENT_CONFIG.SECOND_EVENT_WINDOW_END).toBe(true)
  })
})
