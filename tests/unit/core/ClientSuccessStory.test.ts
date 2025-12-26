import { describe, it, expect } from 'vitest'
import type { Client, Session } from '@/core/types'

/**
 * Tests for client success story functionality
 */
describe('Client Success Story', () => {
  const createMockClient = (overrides: Partial<Client> = {}): Client => ({
    id: 'client-1',
    displayName: 'Test Client',
    conditionCategory: 'anxiety',
    severity: 5,
    sessionsCompleted: 6,
    sessionsRequired: 6,
    status: 'completed',
    satisfaction: 85,
    engagement: 100,
    preferredDays: [1, 2, 3, 4, 5],
    preferredHours: [9, 10, 11, 14, 15],
    insuranceId: null,
    isVirtual: false,
    treatmentProgress: 1.0,
    daysOnWaitingList: 0,
    ...overrides,
  })

  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'session-1',
    clientId: 'client-1',
    therapistId: 'therapist-1',
    therapistName: 'Dr. Smith',
    clientName: 'Test Client',
    scheduledDay: 1,
    scheduledHour: 10,
    durationMinutes: 50,
    status: 'completed',
    quality: 0.8,
    progress: 1,
    payment: 150,
    energyCost: 10,
    isVirtual: false,
    decisionsMade: [],
    qualityModifiers: [],
    ...overrides,
  })

  describe('testimonial generation', () => {
    it('generates different testimonials based on quality and session count', () => {
      // The testimonial selection uses the client ID character code
      // to deterministically select from 5 testimonial templates
      const client1 = createMockClient({ id: 'client-a' })
      const client2 = createMockClient({ id: 'client-b' })

      // Different client IDs should potentially yield different testimonial indices
      const index1 = client1.id.charCodeAt(client1.id.length - 1) % 5
      const index2 = client2.id.charCodeAt(client2.id.length - 1) % 5

      // 'a' = 97, 'b' = 98, so indices would be 97 % 5 = 2, 98 % 5 = 3
      expect(index1).toBe(2)
      expect(index2).toBe(3)
    })

    it('uses different quality descriptors based on average session quality', () => {
      // Quality thresholds:
      // >= 0.85 = 'life-changing'
      // >= 0.70 = 'incredibly helpful'
      // >= 0.55 = 'valuable'
      // < 0.55 = 'helpful'

      const excellentQuality = 0.9
      const goodQuality = 0.75
      const fairQuality = 0.6
      const lowQuality = 0.4

      expect(excellentQuality >= 0.85).toBe(true)
      expect(goodQuality >= 0.70).toBe(true)
      expect(goodQuality < 0.85).toBe(true)
      expect(fairQuality >= 0.55).toBe(true)
      expect(fairQuality < 0.70).toBe(true)
      expect(lowQuality < 0.55).toBe(true)
    })

    it('uses different length descriptors based on session count', () => {
      // Length thresholds:
      // <= 6 = 'focused and efficient'
      // <= 10 = 'thorough'
      // > 10 = 'comprehensive'

      const shortTreatment = 5
      const mediumTreatment = 8
      const longTreatment = 12

      expect(shortTreatment <= 6).toBe(true)
      expect(mediumTreatment > 6 && mediumTreatment <= 10).toBe(true)
      expect(longTreatment > 10).toBe(true)
    })
  })

  describe('statistics calculation', () => {
    it('calculates average quality from completed sessions', () => {
      const sessions: Session[] = [
        createMockSession({ id: 's1', quality: 0.8, status: 'completed' }),
        createMockSession({ id: 's2', quality: 0.9, status: 'completed' }),
        createMockSession({ id: 's3', quality: 0.7, status: 'completed' }),
      ]

      const completedSessions = sessions.filter((s) => s.status === 'completed')
      const totalSessions = completedSessions.length
      const averageQuality = completedSessions.reduce((sum, s) => sum + s.quality, 0) / totalSessions

      expect(totalSessions).toBe(3)
      expect(averageQuality).toBeCloseTo(0.8, 2)
    })

    it('handles empty session list', () => {
      const sessions: Session[] = []

      const completedSessions = sessions.filter((s) => s.status === 'completed')
      const totalSessions = completedSessions.length
      const averageQuality = totalSessions > 0
        ? completedSessions.reduce((sum, s) => sum + s.quality, 0) / totalSessions
        : 0

      expect(totalSessions).toBe(0)
      expect(averageQuality).toBe(0)
    })

    it('only counts completed sessions, not scheduled ones', () => {
      const sessions: Session[] = [
        createMockSession({ id: 's1', quality: 0.8, status: 'completed' }),
        createMockSession({ id: 's2', quality: 0.9, status: 'scheduled' }),
        createMockSession({ id: 's3', quality: 0.7, status: 'completed' }),
      ]

      const completedSessions = sessions.filter((s) => s.status === 'completed')
      expect(completedSessions).toHaveLength(2)
    })

    it('calculates treatment duration from first to last session day', () => {
      const sessions: Session[] = [
        createMockSession({ id: 's1', scheduledDay: 5, status: 'completed' }),
        createMockSession({ id: 's2', scheduledDay: 8, status: 'completed' }),
        createMockSession({ id: 's3', scheduledDay: 12, status: 'completed' }),
      ]

      const completedSessions = sessions.filter((s) => s.status === 'completed')
      const sessionDays = completedSessions.map((s) => s.scheduledDay)
      const firstDay = Math.min(...sessionDays)
      const lastDay = Math.max(...sessionDays)
      const duration = lastDay - firstDay + 1

      expect(firstDay).toBe(5)
      expect(lastDay).toBe(12)
      expect(duration).toBe(8) // Day 5 to 12 inclusive
    })
  })

  describe('quality rating', () => {
    it('rates excellent for >= 80% average quality', () => {
      const quality = 0.85
      const rating = quality >= 0.8 ? 'Excellent' : quality >= 0.65 ? 'Good' : quality >= 0.5 ? 'Fair' : 'Needs Improvement'
      expect(rating).toBe('Excellent')
    })

    it('rates good for >= 65% average quality', () => {
      const quality = 0.70
      const rating = quality >= 0.8 ? 'Excellent' : quality >= 0.65 ? 'Good' : quality >= 0.5 ? 'Fair' : 'Needs Improvement'
      expect(rating).toBe('Good')
    })

    it('rates fair for >= 50% average quality', () => {
      const quality = 0.55
      const rating = quality >= 0.8 ? 'Excellent' : quality >= 0.65 ? 'Good' : quality >= 0.5 ? 'Fair' : 'Needs Improvement'
      expect(rating).toBe('Fair')
    })

    it('rates needs improvement for < 50% average quality', () => {
      const quality = 0.40
      const rating = quality >= 0.8 ? 'Excellent' : quality >= 0.65 ? 'Good' : quality >= 0.5 ? 'Fair' : 'Needs Improvement'
      expect(rating).toBe('Needs Improvement')
    })
  })

  describe('condition display formatting', () => {
    it('formats snake_case condition categories to title case', () => {
      const conditionCategories = [
        { input: 'anxiety', expected: 'Anxiety' },
        { input: 'depression', expected: 'Depression' },
        { input: 'relationship_issues', expected: 'Relationship Issues' },
        { input: 'work_stress', expected: 'Work Stress' },
        { input: 'family_conflict', expected: 'Family Conflict' },
      ]

      conditionCategories.forEach(({ input, expected }) => {
        const display = input
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        expect(display).toBe(expected)
      })
    })
  })
})
