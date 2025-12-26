/**
 * Tests for SessionManager.selectDecisionEvent trigger condition filtering.
 *
 * These tests verify:
 * 1. Events without trigger conditions are always eligible
 * 2. Events with minSeverity filter correctly based on client severity
 * 3. Events with conditionCategories filter correctly based on client condition
 * 4. Events with both conditions require both to match
 */

import { describe, it, expect } from 'vitest'
import { SessionManager } from '@/core/session'
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

describe('SessionManager.selectDecisionEvent', () => {
  describe('events without trigger conditions', () => {
    it('includes events without triggerConditions for any client', () => {
      const events = [
        createDecisionEvent({ id: 'general_1' }),
        createDecisionEvent({ id: 'general_2' }),
      ]

      // Run multiple times to verify random selection works
      const selected = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'anxiety')
        if (event) selected.add(event.id)
      }

      // Both events should be selectable
      expect(selected.has('general_1') || selected.has('general_2')).toBe(true)
    })
  })

  describe('minSeverity filtering', () => {
    it('excludes events when client severity is below minSeverity', () => {
      const events = [
        createDecisionEvent({
          id: 'high_severity_event',
          triggerConditions: { minSeverity: 7 },
        }),
      ]

      // Client with severity 5 should never get this event
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'anxiety')
        expect(event).toBeUndefined()
      }
    })

    it('includes events when client severity meets minSeverity', () => {
      const events = [
        createDecisionEvent({
          id: 'high_severity_event',
          triggerConditions: { minSeverity: 6 },
        }),
      ]

      // Client with severity 7 should be able to get this event
      let found = false
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 7, 'anxiety')
        if (event) {
          found = true
          expect(event.id).toBe('high_severity_event')
        }
      }
      expect(found).toBe(true)
    })

    it('includes events when client severity equals minSeverity', () => {
      const events = [
        createDecisionEvent({
          id: 'exact_severity_event',
          triggerConditions: { minSeverity: 6 },
        }),
      ]

      // Client with severity 6 (exactly min) should be eligible
      let found = false
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 6, 'anxiety')
        if (event) {
          found = true
          expect(event.id).toBe('exact_severity_event')
        }
      }
      expect(found).toBe(true)
    })
  })

  describe('conditionCategories filtering', () => {
    it('excludes events when client condition not in conditionCategories', () => {
      const events = [
        createDecisionEvent({
          id: 'anxiety_only_event',
          triggerConditions: { conditionCategories: ['anxiety'] },
        }),
      ]

      // Client with depression should never get this event
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'depression')
        expect(event).toBeUndefined()
      }
    })

    it('includes events when client condition is in conditionCategories', () => {
      const events = [
        createDecisionEvent({
          id: 'anxiety_event',
          triggerConditions: { conditionCategories: ['anxiety'] },
        }),
      ]

      // Client with anxiety should be able to get this event
      let found = false
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'anxiety')
        if (event) {
          found = true
          expect(event.id).toBe('anxiety_event')
        }
      }
      expect(found).toBe(true)
    })

    it('works with multiple condition categories', () => {
      const events = [
        createDecisionEvent({
          id: 'mood_event',
          triggerConditions: { conditionCategories: ['anxiety', 'depression', 'stress'] },
        }),
      ]

      // Clients with any of these conditions should be eligible
      const conditions: ConditionCategory[] = ['anxiety', 'depression', 'stress']

      for (const condition of conditions) {
        let found = false
        for (let i = 0; i < 50; i++) {
          const event = SessionManager.selectDecisionEvent(events, 5, condition)
          if (event) {
            found = true
            expect(event.id).toBe('mood_event')
          }
        }
        expect(found).toBe(true)
      }
    })
  })

  describe('combined conditions (minSeverity + conditionCategories)', () => {
    it('requires both conditions to be met', () => {
      const events = [
        createDecisionEvent({
          id: 'severe_trauma_event',
          triggerConditions: {
            minSeverity: 7,
            conditionCategories: ['trauma'],
          },
        }),
      ]

      // Severity 5, trauma - fails severity check
      for (let i = 0; i < 30; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'trauma')
        expect(event).toBeUndefined()
      }

      // Severity 8, anxiety - fails category check
      for (let i = 0; i < 30; i++) {
        const event = SessionManager.selectDecisionEvent(events, 8, 'anxiety')
        expect(event).toBeUndefined()
      }

      // Severity 8, trauma - should pass both checks
      let found = false
      for (let i = 0; i < 50; i++) {
        const event = SessionManager.selectDecisionEvent(events, 8, 'trauma')
        if (event) {
          found = true
          expect(event.id).toBe('severe_trauma_event')
        }
      }
      expect(found).toBe(true)
    })
  })

  describe('mixed events (with and without conditions)', () => {
    it('selects only eligible events from a mixed pool', () => {
      const events = [
        createDecisionEvent({ id: 'general_event' }), // Always eligible
        createDecisionEvent({
          id: 'high_severity_event',
          triggerConditions: { minSeverity: 8 },
        }),
        createDecisionEvent({
          id: 'anxiety_event',
          triggerConditions: { conditionCategories: ['anxiety'] },
        }),
      ]

      // Client: severity 5, depression
      // Should only get general_event
      const selectedForDepression = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'depression')
        if (event) selectedForDepression.add(event.id)
      }
      expect(selectedForDepression.has('general_event')).toBe(true)
      expect(selectedForDepression.has('high_severity_event')).toBe(false)
      expect(selectedForDepression.has('anxiety_event')).toBe(false)

      // Client: severity 5, anxiety
      // Should get general_event or anxiety_event
      const selectedForAnxiety = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const event = SessionManager.selectDecisionEvent(events, 5, 'anxiety')
        if (event) selectedForAnxiety.add(event.id)
      }
      expect(selectedForAnxiety.has('general_event')).toBe(true)
      expect(selectedForAnxiety.has('anxiety_event')).toBe(true)
      expect(selectedForAnxiety.has('high_severity_event')).toBe(false)

      // Client: severity 9, trauma
      // Should get general_event or high_severity_event
      const selectedForHighSeverity = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const event = SessionManager.selectDecisionEvent(events, 9, 'trauma')
        if (event) selectedForHighSeverity.add(event.id)
      }
      expect(selectedForHighSeverity.has('general_event')).toBe(true)
      expect(selectedForHighSeverity.has('high_severity_event')).toBe(true)
      expect(selectedForHighSeverity.has('anxiety_event')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns undefined for empty events array', () => {
      const event = SessionManager.selectDecisionEvent([], 5, 'anxiety')
      expect(event).toBeUndefined()
    })

    it('returns undefined when no events are eligible', () => {
      const events = [
        createDecisionEvent({
          id: 'severe_only',
          triggerConditions: { minSeverity: 10 },
        }),
      ]

      const event = SessionManager.selectDecisionEvent(events, 5, 'anxiety')
      expect(event).toBeUndefined()
    })
  })
})
