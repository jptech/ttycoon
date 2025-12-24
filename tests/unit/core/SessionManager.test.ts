import { describe, it, expect } from 'vitest'
import { SessionManager } from '@/core/session'
import type { Session, Therapist, Client, GameTime, DecisionEvent } from '@/core/types'

// Test fixtures
const createMockTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: 'therapist-1',
  displayName: 'Dr. Smith',
  isPlayer: true,
  energy: 100,
  maxEnergy: 100,
  baseSkill: 50,
  level: 5,
  xp: 250,
  hourlySalary: 0,
  hireDay: 1,
  certifications: ['trauma_certified'],
  specializations: ['anxiety_disorders'],
  status: 'available',
  burnoutRecoveryProgress: 0,
  traits: { warmth: 7, analytical: 6, creativity: 5 },
  ...overrides,
})

const createMockClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  displayName: 'Client AB',
  conditionCategory: 'anxiety',
  conditionType: 'general_anxiety',
  severity: 5,
  sessionsRequired: 10,
  sessionsCompleted: 3,
  treatmentProgress: 0.3,
  status: 'in_treatment',
  satisfaction: 70,
  engagement: 75,
  isPrivatePay: true,
  insuranceProvider: null,
  sessionRate: 150,
  prefersVirtual: false,
  preferredFrequency: 'weekly',
  preferredTime: 'morning',
  availability: {
    monday: [9, 10, 11],
    tuesday: [9, 10, 11],
    wednesday: [9, 10, 11],
    thursday: [9, 10, 11],
    friday: [9, 10, 11],
  },
  requiredCertification: null,
  isMinor: false,
  isCouple: false,
  arrivalDay: 1,
  daysWaiting: 0,
  maxWaitDays: 14,
  assignedTherapistId: 'therapist-1',
  ...overrides,
})

const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  therapistId: 'therapist-1',
  clientId: 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: false,
  scheduledDay: 1,
  scheduledHour: 9,
  durationMinutes: 50,
  status: 'scheduled',
  progress: 0,
  quality: 0.5,
  qualityModifiers: [],
  payment: 150,
  energyCost: 15,
  xpGained: 0,
  decisionsMade: [],
  therapistName: 'Dr. Smith',
  clientName: 'Client AB',
  ...overrides,
})

describe('SessionManager', () => {
  describe('shouldStartSession', () => {
    it('returns true when time matches and session is scheduled', () => {
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })
      const currentTime: GameTime = { day: 1, hour: 9, minute: 0 }

      expect(SessionManager.shouldStartSession(session, currentTime)).toBe(true)
    })

    it('returns false when minute is not 0', () => {
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })
      const currentTime: GameTime = { day: 1, hour: 9, minute: 15 }

      expect(SessionManager.shouldStartSession(session, currentTime)).toBe(false)
    })

    it('returns false when hour does not match', () => {
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      expect(SessionManager.shouldStartSession(session, currentTime)).toBe(false)
    })

    it('returns false when session is not scheduled', () => {
      const session = createMockSession({ status: 'in_progress' })
      const currentTime: GameTime = { day: 1, hour: 9, minute: 0 }

      expect(SessionManager.shouldStartSession(session, currentTime)).toBe(false)
    })
  })

  describe('startSession', () => {
    it('transitions session to in_progress', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient()

      const result = SessionManager.startSession(session, therapist, client)

      expect(result.session.status).toBe('in_progress')
      expect(result.session.progress).toBe(0)
    })

    it('sets therapist status to in_session', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient()

      const result = SessionManager.startSession(session, therapist, client)

      expect(result.therapist.status).toBe('in_session')
    })

    it('sets client status to in_treatment', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient({ status: 'waiting' })

      const result = SessionManager.startSession(session, therapist, client)

      expect(result.client.status).toBe('in_treatment')
    })

    it('calculates quality modifiers', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient()

      const result = SessionManager.startSession(session, therapist, client)

      expect(result.session.qualityModifiers.length).toBeGreaterThan(0)
      expect(result.session.quality).toBeGreaterThan(0)
    })
  })

  describe('calculateInitialQualityModifiers', () => {
    it('adds skill bonus based on therapist skill', () => {
      const therapist = createMockTherapist({ baseSkill: 80 })
      const client = createMockClient()
      const session = createMockSession()

      const modifiers = SessionManager.calculateInitialQualityModifiers(therapist, client, session)
      const skillModifier = modifiers.find((m) => m.source === 'therapist_skill')

      expect(skillModifier).toBeDefined()
      expect(skillModifier!.value).toBeCloseTo(0.24, 2) // 80/100 * 0.3
    })

    it('adds energy modifier based on therapist energy', () => {
      const therapist = createMockTherapist({ energy: 30, maxEnergy: 100 })
      const client = createMockClient()
      const session = createMockSession()

      const modifiers = SessionManager.calculateInitialQualityModifiers(therapist, client, session)
      const energyModifier = modifiers.find((m) => m.source === 'therapist_energy')

      expect(energyModifier).toBeDefined()
      expect(energyModifier!.value).toBeLessThan(0) // Low energy = negative modifier
    })

    it('adds specialization match bonus', () => {
      const therapist = createMockTherapist({ specializations: ['anxiety_disorders'] })
      const client = createMockClient({ conditionCategory: 'anxiety' })
      const session = createMockSession()

      const modifiers = SessionManager.calculateInitialQualityModifiers(therapist, client, session)
      const specModifier = modifiers.find((m) => m.source === 'specialization_match')

      expect(specModifier).toBeDefined()
      expect(specModifier!.value).toBe(0.1)
    })

    it('adds virtual mismatch penalty', () => {
      const therapist = createMockTherapist()
      const client = createMockClient({ prefersVirtual: false })
      const session = createMockSession({ isVirtual: true })

      const modifiers = SessionManager.calculateInitialQualityModifiers(therapist, client, session)
      const virtualModifier = modifiers.find((m) => m.source === 'virtual_mismatch')

      expect(virtualModifier).toBeDefined()
      expect(virtualModifier!.value).toBe(-0.05)
    })
  })

  describe('progressSession', () => {
    it('increases progress based on time delta', () => {
      const session = createMockSession({ status: 'in_progress', progress: 0, durationMinutes: 50 })

      const result = SessionManager.progressSession(session, 10, [])

      expect(result.session.progress).toBeCloseTo(0.2, 2) // 10/50 = 0.2
      expect(result.progressDelta).toBeCloseTo(0.2, 2)
    })

    it('caps progress at 1', () => {
      const session = createMockSession({ status: 'in_progress', progress: 0.9 })

      const result = SessionManager.progressSession(session, 100, [])

      expect(result.session.progress).toBe(1)
    })

    it('does not progress non-in_progress sessions', () => {
      const session = createMockSession({ status: 'scheduled', progress: 0 })

      const result = SessionManager.progressSession(session, 10, [])

      expect(result.session.progress).toBe(0)
      expect(result.progressDelta).toBe(0)
    })
  })

  describe('applyDecision', () => {
    it('applies quality effect from decision', () => {
      const session = createMockSession({ status: 'in_progress', quality: 0.5 })
      const therapist = createMockTherapist()
      const event: DecisionEvent = {
        id: 'test_event',
        title: 'Test Event',
        description: 'Test description',
        choices: [
          { text: 'Choice 1', effects: { quality: 0.1 } },
          { text: 'Choice 2', effects: { quality: -0.1 } },
        ],
      }

      const result = SessionManager.applyDecision(session, therapist, event, 0)

      expect(result.session.quality).toBeCloseTo(0.6, 2)
      expect(result.session.decisionsMade.length).toBe(1)
      expect(result.session.decisionsMade[0].eventId).toBe('test_event')
    })

    it('applies energy effect from decision', () => {
      const session = createMockSession({ status: 'in_progress' })
      const therapist = createMockTherapist({ energy: 80 })
      const event: DecisionEvent = {
        id: 'test_event',
        title: 'Test Event',
        description: 'Test description',
        choices: [{ text: 'Choice', effects: { energy: -10 } }],
      }

      const result = SessionManager.applyDecision(session, therapist, event, 0)

      expect(result.therapist.energy).toBe(70)
    })

    it('adds quality modifier for the decision', () => {
      const session = createMockSession({ status: 'in_progress', qualityModifiers: [] })
      const therapist = createMockTherapist()
      const event: DecisionEvent = {
        id: 'test_event',
        title: 'Test Event',
        description: 'Test description',
        choices: [{ text: 'Choice', effects: { quality: 0.1 } }],
      }

      const result = SessionManager.applyDecision(session, therapist, event, 0)

      const decisionModifier = result.session.qualityModifiers.find((m) =>
        m.source.startsWith('decision_')
      )
      expect(decisionModifier).toBeDefined()
    })
  })

  describe('isSessionComplete', () => {
    it('returns true when progress >= 1 and status is in_progress', () => {
      const session = createMockSession({ status: 'in_progress', progress: 1 })
      expect(SessionManager.isSessionComplete(session)).toBe(true)
    })

    it('returns false when progress < 1', () => {
      const session = createMockSession({ status: 'in_progress', progress: 0.9 })
      expect(SessionManager.isSessionComplete(session)).toBe(false)
    })

    it('returns false when status is not in_progress', () => {
      const session = createMockSession({ status: 'completed', progress: 1 })
      expect(SessionManager.isSessionComplete(session)).toBe(false)
    })
  })

  describe('completeSession', () => {
    it('sets session status to completed', () => {
      const session = createMockSession({ status: 'in_progress', progress: 1, quality: 0.7 })
      const therapist = createMockTherapist()
      const client = createMockClient()
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.session.status).toBe('completed')
      expect(result.session.completedAt).toEqual(currentTime)
    })

    it('calculates XP gained', () => {
      const session = createMockSession({ status: 'in_progress', progress: 1, quality: 0.8 })
      const therapist = createMockTherapist({ xp: 100 })
      const client = createMockClient()
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.xpGained).toBeGreaterThan(0)
      expect(result.therapist.xp).toBe(100 + result.xpGained)
    })

    it('applies energy cost', () => {
      const session = createMockSession({ status: 'in_progress', energyCost: 15 })
      const therapist = createMockTherapist({ energy: 80 })
      const client = createMockClient()
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.therapist.energy).toBe(65)
    })

    it('updates client treatment progress', () => {
      const session = createMockSession({ status: 'in_progress', quality: 0.8 })
      const therapist = createMockTherapist()
      const client = createMockClient({ treatmentProgress: 0.3, sessionsCompleted: 3 })
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.client.treatmentProgress).toBeGreaterThan(0.3)
      expect(result.client.sessionsCompleted).toBe(4)
    })

    it('marks client as completed when treatment is done', () => {
      const session = createMockSession({ status: 'in_progress', quality: 1 })
      const therapist = createMockTherapist()
      const client = createMockClient({ sessionsCompleted: 9, sessionsRequired: 10 })
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.client.status).toBe('completed')
    })

    it('restores therapist status to available', () => {
      const session = createMockSession({ status: 'in_progress' })
      const therapist = createMockTherapist({ status: 'in_session' })
      const client = createMockClient()
      const currentTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = SessionManager.completeSession(session, therapist, client, currentTime)

      expect(result.therapist.status).toBe('available')
    })
  })

  describe('calculateLevel', () => {
    it('returns level 1 for 0 XP', () => {
      expect(SessionManager.calculateLevel(0)).toBe(1)
    })

    it('returns level 2 for 10 XP', () => {
      expect(SessionManager.calculateLevel(10)).toBe(2)
    })

    it('returns level 3 for 40 XP', () => {
      expect(SessionManager.calculateLevel(40)).toBe(3)
    })

    it('increases levels progressively', () => {
      const level5 = SessionManager.calculateLevel(160)
      const level10 = SessionManager.calculateLevel(810)

      expect(level5).toBe(5)
      expect(level10).toBe(10)
    })
  })

  describe('cancelSession', () => {
    it('sets session status to cancelled', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient()

      const result = SessionManager.cancelSession(session, therapist, client, 'Client cancelled')

      expect(result.session.status).toBe('cancelled')
    })

    it('reduces client satisfaction', () => {
      const session = createMockSession()
      const therapist = createMockTherapist()
      const client = createMockClient({ satisfaction: 70 })

      const result = SessionManager.cancelSession(session, therapist, client, 'Client cancelled')

      expect(result.client.satisfaction).toBe(60)
    })

    it('restores therapist status if was in session', () => {
      const session = createMockSession()
      const therapist = createMockTherapist({ status: 'in_session' })
      const client = createMockClient()

      const result = SessionManager.cancelSession(session, therapist, client, 'Emergency')

      expect(result.therapist.status).toBe('available')
    })
  })

  describe('getQualityRating', () => {
    it('returns Excellent for quality >= 0.9', () => {
      expect(SessionManager.getQualityRating(0.95)).toBe('Excellent')
    })

    it('returns Good for quality >= 0.75', () => {
      expect(SessionManager.getQualityRating(0.8)).toBe('Good')
    })

    it('returns Fair for quality >= 0.5', () => {
      expect(SessionManager.getQualityRating(0.6)).toBe('Fair')
    })

    it('returns Poor for quality >= 0.25', () => {
      expect(SessionManager.getQualityRating(0.3)).toBe('Poor')
    })

    it('returns Very Poor for quality < 0.25', () => {
      expect(SessionManager.getQualityRating(0.1)).toBe('Very Poor')
    })
  })

  describe('getQualityVariant', () => {
    it('returns success for quality >= 0.7', () => {
      expect(SessionManager.getQualityVariant(0.8)).toBe('success')
    })

    it('returns warning for quality >= 0.4', () => {
      expect(SessionManager.getQualityVariant(0.5)).toBe('warning')
    })

    it('returns error for quality < 0.4', () => {
      expect(SessionManager.getQualityVariant(0.2)).toBe('error')
    })
  })
})
