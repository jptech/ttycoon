import { describe, it, expect } from 'vitest'
import { ScheduleManager } from '@/core/schedule'
import type { Schedule, Session, Therapist, Client } from '@/core/types'
import type { GameTime } from '@/core/types'

// Test fixtures
const createMockTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: 'therapist-1',
  displayName: 'Dr. Smith',
  isPlayer: true,
  energy: 100,
  maxEnergy: 100,
  baseSkill: 50,
  level: 1,
  xp: 0,
  hourlySalary: 0,
  hireDay: 1,
  certifications: [],
  specializations: [],
  status: 'available',
  burnoutRecoveryProgress: 0,
  traits: { warmth: 5, analytical: 5, creativity: 5 },
  ...overrides,
})

const createMockClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  displayName: 'Client AB',
  conditionCategory: 'anxiety',
  conditionType: 'general_anxiety',
  severity: 5,
  sessionsRequired: 10,
  sessionsCompleted: 0,
  treatmentProgress: 0,
  status: 'waiting',
  satisfaction: 70,
  engagement: 70,
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
  assignedTherapistId: null,
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

// Test helper: recursively freeze objects/arrays to simulate Immer-frozen Zustand state
function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value

  Object.freeze(value)

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key]
    deepFreeze(child)
  }

  return value
}

describe('ScheduleManager', () => {
  describe('validateNotInPast', () => {
    it('rejects scheduling on a previous day', () => {
      const now: GameTime = { day: 3, hour: 10, minute: 0 }
      expect(ScheduleManager.validateNotInPast(now, 2, 10).valid).toBe(false)
    })

    it('rejects scheduling for a past hour on the same day', () => {
      const now: GameTime = { day: 3, hour: 10, minute: 0 }
      expect(ScheduleManager.validateNotInPast(now, 3, 9).valid).toBe(false)
    })

    it('rejects scheduling for the current hour when minute > 0', () => {
      const now: GameTime = { day: 3, hour: 10, minute: 15 }
      expect(ScheduleManager.validateNotInPast(now, 3, 10).valid).toBe(false)
    })

    it('allows scheduling for the current hour when minute === 0', () => {
      const now: GameTime = { day: 3, hour: 10, minute: 0 }
      expect(ScheduleManager.validateNotInPast(now, 3, 10).valid).toBe(true)
    })

    it('allows scheduling for a future day', () => {
      const now: GameTime = { day: 3, hour: 16, minute: 50 }
      expect(ScheduleManager.validateNotInPast(now, 4, 8).valid).toBe(true)
    })
  })

  describe('buildScheduleFromSessions', () => {
    it('includes scheduled, in-progress, and completed sessions', () => {
      const scheduled = createMockSession({
        id: 'scheduled-1',
        therapistId: 'therapist-1',
        scheduledDay: 2,
        scheduledHour: 10,
        status: 'scheduled',
      })

      const inProgress = createMockSession({
        id: 'inprogress-1',
        therapistId: 'therapist-2',
        scheduledDay: 2,
        scheduledHour: 11,
        status: 'in_progress',
      })

      const completed = createMockSession({
        id: 'completed-1',
        therapistId: 'therapist-3',
        scheduledDay: 2,
        scheduledHour: 12,
        status: 'completed',
      })

      const schedule = ScheduleManager.buildScheduleFromSessions([scheduled, inProgress, completed])

      expect(schedule[2][10]['therapist-1']).toBe('scheduled-1')
      expect(schedule[2][11]['therapist-2']).toBe('inprogress-1')
      expect(schedule[2][12]['therapist-3']).toBe('completed-1')
    })

    it('represents multi-hour sessions across all occupied hour slots', () => {
      const longSession = createMockSession({
        id: 'long-1',
        therapistId: 'therapist-1',
        scheduledDay: 1,
        scheduledHour: 9,
        durationMinutes: 80,
        status: 'scheduled',
      })

      const schedule = ScheduleManager.buildScheduleFromSessions([longSession])
      expect(schedule[1][9]['therapist-1']).toBe('long-1')
      expect(schedule[1][10]['therapist-1']).toBe('long-1')
    })
  })

  describe('isSlotAvailable', () => {
    it('returns true for empty schedule', () => {
      const schedule: Schedule = {}
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 9)).toBe(true)
    })

    it('returns false for occupied slot', () => {
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': 'session-1' },
        },
      }
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 9)).toBe(false)
    })

    it('returns true for different therapist in same slot', () => {
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': 'session-1' },
        },
      }
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-2', 1, 9)).toBe(true)
    })

    it('returns false for slots outside business hours', () => {
      const schedule: Schedule = {}
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 7)).toBe(false)
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 17)).toBe(false)
    })

    it('checks multiple slots for longer sessions', () => {
      const schedule: Schedule = {
        1: {
          10: { 'therapist-1': 'session-1' },
        },
      }
      // 80 min session starting at 9 would need 9 and 10
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 9, 80)).toBe(false)
      // 50 min session at 9 is fine
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 9, 50)).toBe(true)
    })

    it('returns false if session would extend past business hours', () => {
      const schedule: Schedule = {}
      // 80 min session at 16:00 would end at 17:20, past business end
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 16, 80)).toBe(false)
    })
  })

  describe('getAvailableSlotsForDay', () => {
    it('returns all business hours for empty schedule', () => {
      const schedule: Schedule = {}
      const slots = ScheduleManager.getAvailableSlotsForDay(schedule, 'therapist-1', 1)

      expect(slots).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
    })

    it('excludes occupied slots', () => {
      const schedule: Schedule = {
        1: {
          10: { 'therapist-1': 'session-1' },
          14: { 'therapist-1': 'session-2' },
        },
      }
      const slots = ScheduleManager.getAvailableSlotsForDay(schedule, 'therapist-1', 1)

      expect(slots).not.toContain(10)
      expect(slots).not.toContain(14)
      expect(slots).toContain(9)
      expect(slots).toContain(11)
    })
  })

  describe('getDayOfWeek', () => {
    it('returns correct day of week', () => {
      expect(ScheduleManager.getDayOfWeek(1)).toBe('monday')
      expect(ScheduleManager.getDayOfWeek(2)).toBe('tuesday')
      expect(ScheduleManager.getDayOfWeek(3)).toBe('wednesday')
      expect(ScheduleManager.getDayOfWeek(4)).toBe('thursday')
      expect(ScheduleManager.getDayOfWeek(5)).toBe('friday')
      // Wraps around
      expect(ScheduleManager.getDayOfWeek(6)).toBe('monday')
      expect(ScheduleManager.getDayOfWeek(10)).toBe('friday')
    })
  })

  describe('matchesTimePreference', () => {
    it('morning preference matches 8-11', () => {
      expect(ScheduleManager.matchesTimePreference(8, 'morning')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(11, 'morning')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(12, 'morning')).toBe(false)
    })

    it('afternoon preference matches 12-15', () => {
      expect(ScheduleManager.matchesTimePreference(12, 'afternoon')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(15, 'afternoon')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(16, 'afternoon')).toBe(false)
    })

    it('evening preference matches 16-17', () => {
      expect(ScheduleManager.matchesTimePreference(16, 'evening')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(17, 'evening')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(15, 'evening')).toBe(false)
    })

    it('any preference matches all hours', () => {
      expect(ScheduleManager.matchesTimePreference(8, 'any')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(12, 'any')).toBe(true)
      expect(ScheduleManager.matchesTimePreference(16, 'any')).toBe(true)
    })
  })

  describe('createSession', () => {
    it('creates session with correct properties', () => {
      const therapist = createMockTherapist()
      const client = createMockClient()
      const params = {
        therapistId: therapist.id,
        clientId: client.id,
        day: 1,
        hour: 10,
      }

      const session = ScheduleManager.createSession(params, therapist, client)

      expect(session.therapistId).toBe(therapist.id)
      expect(session.clientId).toBe(client.id)
      expect(session.scheduledDay).toBe(1)
      expect(session.scheduledHour).toBe(10)
      expect(session.status).toBe('scheduled')
      expect(session.durationMinutes).toBe(50)
      expect(session.payment).toBe(client.sessionRate)
    })

    it('uses client virtual preference by default', () => {
      const therapist = createMockTherapist()
      const client = createMockClient({ prefersVirtual: true })
      const params = {
        therapistId: therapist.id,
        clientId: client.id,
        day: 1,
        hour: 10,
      }

      const session = ScheduleManager.createSession(params, therapist, client)
      expect(session.isVirtual).toBe(true)
    })

    it('sets isInsurance based on client payment type', () => {
      const therapist = createMockTherapist()
      const privatePayClient = createMockClient({ isPrivatePay: true })
      const insuranceClient = createMockClient({ isPrivatePay: false })

      const session1 = ScheduleManager.createSession(
        { therapistId: therapist.id, clientId: privatePayClient.id, day: 1, hour: 10 },
        therapist,
        privatePayClient
      )
      expect(session1.isInsurance).toBe(false)

      const session2 = ScheduleManager.createSession(
        { therapistId: therapist.id, clientId: insuranceClient.id, day: 1, hour: 10 },
        therapist,
        insuranceClient
      )
      expect(session2.isInsurance).toBe(true)
    })
  })

  describe('addToSchedule', () => {
    it('adds session to empty schedule', () => {
      const schedule: Schedule = {}
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9 })

      const newSchedule = ScheduleManager.addToSchedule(schedule, session)

      expect(newSchedule[1][9]['therapist-1']).toBe(session.id)
    })

    it('adds multiple slots for longer sessions', () => {
      const schedule: Schedule = {}
      const session = createMockSession({
        scheduledDay: 1,
        scheduledHour: 9,
        durationMinutes: 80,
      })

      const newSchedule = ScheduleManager.addToSchedule(schedule, session)

      expect(newSchedule[1][9]['therapist-1']).toBe(session.id)
      expect(newSchedule[1][10]['therapist-1']).toBe(session.id)
    })

    it('preserves existing schedule entries', () => {
      const schedule: Schedule = {
        1: {
          14: { 'therapist-1': 'existing-session' },
        },
      }
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9 })

      const newSchedule = ScheduleManager.addToSchedule(schedule, session)

      expect(newSchedule[1][14]['therapist-1']).toBe('existing-session')
      expect(newSchedule[1][9]['therapist-1']).toBe(session.id)
    })

    it('does not mutate a frozen schedule (regression)', () => {
      const schedule: Schedule = {
        1: {
          14: { 'therapist-1': 'existing-session' },
        },
      }
      deepFreeze(schedule)

      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9 })

      let newSchedule: Schedule | undefined
      expect(() => {
        newSchedule = ScheduleManager.addToSchedule(schedule, session)
      }).not.toThrow()

      // Original schedule remains unchanged
      expect(schedule[1][9]).toBeUndefined()
      expect(schedule[1][14]['therapist-1']).toBe('existing-session')

      // New schedule contains the booking
      expect(newSchedule![1][9]['therapist-1']).toBe(session.id)
      expect(newSchedule![1][14]['therapist-1']).toBe('existing-session')
    })
  })

  describe('removeFromSchedule', () => {
    it('removes session from schedule', () => {
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9 })
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': session.id },
        },
      }

      const newSchedule = ScheduleManager.removeFromSchedule(schedule, session)

      expect(newSchedule[1][9]['therapist-1']).toBeUndefined()
    })

    it('removes multiple slots for longer sessions', () => {
      const session = createMockSession({
        scheduledDay: 1,
        scheduledHour: 9,
        durationMinutes: 80,
      })
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': session.id },
          10: { 'therapist-1': session.id },
        },
      }

      const newSchedule = ScheduleManager.removeFromSchedule(schedule, session)

      expect(newSchedule[1][9]['therapist-1']).toBeUndefined()
      expect(newSchedule[1][10]['therapist-1']).toBeUndefined()
    })

    it('does not mutate a frozen schedule (regression)', () => {
      const session = createMockSession({ scheduledDay: 1, scheduledHour: 9 })
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': session.id },
        },
      }
      deepFreeze(schedule)

      let newSchedule: Schedule | undefined
      expect(() => {
        newSchedule = ScheduleManager.removeFromSchedule(schedule, session)
      }).not.toThrow()

      // Original schedule remains unchanged
      expect(schedule[1][9]['therapist-1']).toBe(session.id)

      // New schedule has the session removed
      expect(newSchedule![1][9]['therapist-1']).toBeUndefined()
    })
  })

  describe('getSessionsForDay', () => {
    it('returns sessions for specified day', () => {
      const session1 = createMockSession({ id: 'session-1', scheduledDay: 1 })
      const session2 = createMockSession({ id: 'session-2', scheduledDay: 1, scheduledHour: 14 })
      const session3 = createMockSession({ id: 'session-3', scheduledDay: 2 })
      const sessions = [session1, session2, session3]

      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': 'session-1' },
          14: { 'therapist-1': 'session-2' },
        },
        2: {
          9: { 'therapist-1': 'session-3' },
        },
      }

      const daySessions = ScheduleManager.getSessionsForDay(schedule, sessions, 1)

      expect(daySessions).toHaveLength(2)
      expect(daySessions.map((s) => s.id)).toContain('session-1')
      expect(daySessions.map((s) => s.id)).toContain('session-2')
    })
  })

  describe('formatHour', () => {
    it('formats hours correctly', () => {
      expect(ScheduleManager.formatHour(8)).toBe('8:00 AM')
      expect(ScheduleManager.formatHour(12)).toBe('12:00 PM')
      expect(ScheduleManager.formatHour(13)).toBe('1:00 PM')
      expect(ScheduleManager.formatHour(17)).toBe('5:00 PM')
    })
  })

  describe('getSessionTimeRange', () => {
    it('returns correct time range for 50 min session', () => {
      const session = createMockSession({ scheduledHour: 9, durationMinutes: 50 })
      expect(ScheduleManager.getSessionTimeRange(session)).toBe('9:00 AM - 9:50 AM')
    })

    it('returns correct time range for 80 min session', () => {
      const session = createMockSession({ scheduledHour: 14, durationMinutes: 80 })
      expect(ScheduleManager.getSessionTimeRange(session)).toBe('2:00 PM - 3:20 PM')
    })
  })

  describe('calculateEnergyCost', () => {
    it('calculates base costs correctly', () => {
      expect(ScheduleManager.calculateEnergyCost(50, 1)).toBe(15)
      expect(ScheduleManager.calculateEnergyCost(80, 1)).toBe(25)
      expect(ScheduleManager.calculateEnergyCost(180, 1)).toBe(50)
    })

    it('reduces cost for higher level therapists', () => {
      const level1Cost = ScheduleManager.calculateEnergyCost(50, 1)
      const level50Cost = ScheduleManager.calculateEnergyCost(50, 50)

      expect(level50Cost).toBeLessThan(level1Cost)
    })
  })

  describe('getConflicts', () => {
    it('returns empty array for available slot', () => {
      const schedule: Schedule = {}
      const conflicts = ScheduleManager.getConflicts(schedule, 'therapist-1', 1, 9)

      expect(conflicts).toHaveLength(0)
    })

    it('returns conflicts for occupied slots', () => {
      const schedule: Schedule = {
        1: {
          9: { 'therapist-1': 'existing-session' },
        },
      }
      const conflicts = ScheduleManager.getConflicts(schedule, 'therapist-1', 1, 9)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].existingSessionId).toBe('existing-session')
    })
  })

  describe('clientHasConflictingSession', () => {
    it('detects overlap on the same hour', () => {
      const sessions: Session[] = [
        createMockSession({
          id: 's1',
          clientId: 'client-1',
          scheduledDay: 2,
          scheduledHour: 10,
          durationMinutes: 50,
          status: 'scheduled',
        }),
      ]

      expect(
        ScheduleManager.clientHasConflictingSession(sessions, 'client-1', 2, 10, 50)
      ).toBe(true)
    })

    it('detects overlap across multi-hour sessions', () => {
      const sessions: Session[] = [
        createMockSession({
          id: 'long',
          clientId: 'client-1',
          scheduledDay: 2,
          scheduledHour: 9,
          durationMinutes: 80,
          status: 'scheduled',
        }),
      ]

      // Proposed 10:00 overlaps a 9:00-11:00 session.
      expect(
        ScheduleManager.clientHasConflictingSession(sessions, 'client-1', 2, 10, 50)
      ).toBe(true)
    })

    it('ignores completed/cancelled sessions', () => {
      const sessions: Session[] = [
        createMockSession({
          id: 'completed',
          clientId: 'client-1',
          scheduledDay: 2,
          scheduledHour: 10,
          durationMinutes: 50,
          status: 'completed',
        }),
        createMockSession({
          id: 'cancelled',
          clientId: 'client-1',
          scheduledDay: 2,
          scheduledHour: 10,
          durationMinutes: 50,
          status: 'cancelled',
        }),
      ]

      expect(
        ScheduleManager.clientHasConflictingSession(sessions, 'client-1', 2, 10, 50)
      ).toBe(false)
    })
  })
})
