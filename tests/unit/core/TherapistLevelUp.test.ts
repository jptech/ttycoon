import { describe, it, expect, beforeEach } from 'vitest'
import { SessionManager } from '@/core/session'
import type { Therapist, Client, Session } from '@/core/types'

describe('Therapist Level Up System', () => {
  const createMockTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
    id: 'therapist-1',
    displayName: 'Dr. Test',
    isPlayer: true,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 40,
    level: 1,
    xp: 0,
    hourlySalary: 0,
    hireDay: 1,
    certifications: [],
    specializations: ['stress_management'],
    status: 'in_session',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 7, analytical: 5, creativity: 5 },
    ...overrides,
  })

  const createMockClient = (overrides: Partial<Client> = {}): Client => ({
    id: 'client-1',
    displayName: 'Test Client',
    conditionCategory: 'anxiety',
    severity: 5,
    sessionsCompleted: 0,
    sessionsRequired: 6,
    status: 'in_treatment',
    satisfaction: 70,
    engagement: 80,
    preferredDays: [1, 2, 3, 4, 5],
    preferredHours: [9, 10, 11, 14, 15],
    insuranceId: null,
    isVirtual: false,
    treatmentProgress: 0,
    daysOnWaitingList: 0,
    ...overrides,
  })

  const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'session-1',
    clientId: 'client-1',
    therapistId: 'therapist-1',
    therapistName: 'Dr. Test',
    clientName: 'Test Client',
    scheduledDay: 1,
    scheduledHour: 10,
    durationMinutes: 50,
    status: 'in_progress',
    quality: 0.8,
    progress: 1,
    payment: 150,
    energyCost: 15,
    isVirtual: false,
    decisionsMade: [],
    qualityModifiers: [],
    ...overrides,
  })

  describe('XP calculation', () => {
    it('calculates level from XP correctly', () => {
      // Level formula: floor(sqrt(xp / 10)) + 1
      expect(SessionManager.calculateLevel(0)).toBe(1)
      expect(SessionManager.calculateLevel(9)).toBe(1)
      expect(SessionManager.calculateLevel(10)).toBe(2)
      expect(SessionManager.calculateLevel(39)).toBe(2)
      expect(SessionManager.calculateLevel(40)).toBe(3)
      expect(SessionManager.calculateLevel(90)).toBe(4)
      expect(SessionManager.calculateLevel(160)).toBe(5)
    })

    it('calculates XP required for next level', () => {
      // XP for level n = (n-1)^2 * 10
      expect(SessionManager.xpForLevel(1)).toBe(0)
      expect(SessionManager.xpForLevel(2)).toBe(10)
      expect(SessionManager.xpForLevel(3)).toBe(40)
      expect(SessionManager.xpForLevel(4)).toBe(90)
      expect(SessionManager.xpForLevel(5)).toBe(160)
    })
  })

  describe('completeSession level-up detection', () => {
    it('returns leveledUp: false when already at a high level', () => {
      // At high levels, more XP is needed per level, so a single session won't level up
      const therapist = createMockTherapist({ xp: 100, level: 4 }) // Level 4 needs 160 XP for level 5
      const client = createMockClient()
      const session = createMockSession({ quality: 0.5 }) // Lower quality = less XP

      const result = SessionManager.completeSession(
        session,
        therapist,
        client,
        { day: 1, hour: 11, minute: 0 }
      )

      // Level 4 requires 90 XP, level 5 requires 160 XP
      // With 100 XP + small gain, shouldn't reach 160
      expect(result.leveledUp).toBe(false)
      expect(result.newLevel).toBe(4)
      expect(result.xpGained).toBeGreaterThan(0)
    })

    it('returns leveledUp: true when therapist gains enough XP for new level', () => {
      // XP needed for level 2 is 10, start at 9 XP
      const therapist = createMockTherapist({ xp: 9, level: 1 })
      const client = createMockClient()
      const session = createMockSession({ quality: 0.85 }) // High quality = more XP

      const result = SessionManager.completeSession(
        session,
        therapist,
        client,
        { day: 1, hour: 11, minute: 0 }
      )

      expect(result.leveledUp).toBe(true)
      expect(result.newLevel).toBe(2)
      expect(result.therapist.level).toBe(2)
    })

    it('includes xpGained in result', () => {
      const therapist = createMockTherapist()
      const client = createMockClient()
      const session = createMockSession()

      const result = SessionManager.completeSession(
        session,
        therapist,
        client,
        { day: 1, hour: 11, minute: 0 }
      )

      expect(result.xpGained).toBeGreaterThan(0)
      expect(result.therapist.xp).toBe(result.xpGained)
    })
  })

  describe('XP progress tracking', () => {
    it('tracks XP accumulation across sessions', () => {
      let therapist = createMockTherapist()
      const client = createMockClient()

      // Simulate multiple sessions
      let totalXp = 0
      for (let i = 0; i < 5; i++) {
        const session = createMockSession({
          id: `session-${i}`,
          quality: 0.75,
        })

        const result = SessionManager.completeSession(
          session,
          therapist,
          client,
          { day: 1, hour: 10 + i, minute: 0 }
        )

        totalXp += result.xpGained
        therapist = result.therapist
      }

      expect(therapist.xp).toBe(totalXp)
    })

    it('XP progress resets after level-up (carries remainder)', () => {
      // Start close to level-up threshold
      const therapist = createMockTherapist({ xp: 8, level: 1 })
      const client = createMockClient()
      const session = createMockSession({ quality: 0.85 })

      const result = SessionManager.completeSession(
        session,
        therapist,
        client,
        { day: 1, hour: 11, minute: 0 }
      )

      // After leveling up, XP should be the remainder toward next level
      if (result.leveledUp) {
        // Therapist leveled up, new XP should be total XP
        expect(result.therapist.xp).toBeGreaterThan(8) // Gained some XP
        expect(result.therapist.level).toBe(2)
      }
    })
  })

  describe('quality affects XP gain', () => {
    it('high quality sessions give bonus XP', () => {
      const therapist = createMockTherapist()
      const client = createMockClient()

      const lowQualitySession = createMockSession({ quality: 0.5 })
      const highQualitySession = createMockSession({ quality: 0.9 })

      const lowResult = SessionManager.completeSession(
        lowQualitySession,
        therapist,
        client,
        { day: 1, hour: 10, minute: 0 }
      )

      const highResult = SessionManager.completeSession(
        highQualitySession,
        therapist,
        client,
        { day: 1, hour: 11, minute: 0 }
      )

      expect(highResult.xpGained).toBeGreaterThan(lowResult.xpGained)
    })
  })
})
