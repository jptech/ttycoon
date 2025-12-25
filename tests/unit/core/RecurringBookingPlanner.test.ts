import { describe, it, expect } from 'vitest'
import { planRecurringBookings, ScheduleManager } from '@/core/schedule'
import type { Building, Client, Schedule, Session, Therapist } from '@/core/types'

const building: Building = {
  id: 'b1',
  name: 'Test Building',
  tier: 1,
  rooms: 10,
  monthlyRent: 0,
  upgradeCost: 0,
  requiredLevel: 1,
}

const createTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: 't1',
  displayName: 'Therapist',
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

const createClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'c1',
  displayName: 'Client',
  conditionCategory: 'anxiety',
  conditionType: 'Generalized Anxiety',
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
  preferredTime: 'any',
  availability: {
    monday: [8, 9, 10, 11, 14, 15, 16],
    tuesday: [8, 9, 10, 11, 14, 15, 16],
    wednesday: [8, 9, 10, 11, 14, 15, 16],
    thursday: [8, 9, 10, 11, 14, 15, 16],
    friday: [8, 9, 10, 11, 14, 15, 16],
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

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  therapistId: 't1',
  clientId: 'c1',
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
  therapistName: 'Therapist',
  clientName: 'Client',
  ...overrides,
})

describe('planRecurringBookings', () => {
  it('plans a weekly series at the same hour when available', () => {
    const therapist = createTherapist()
    const client = createClient()
    const sessions: Session[] = []
    const schedule: Schedule = {}

    const result = planRecurringBookings({
      schedule,
      sessions,
      therapist,
      client,
      building,
      telehealthUnlocked: true,
      currentTime: { day: 1, hour: 8, minute: 0 },
      startDay: 1,
      startHour: 9,
      durationMinutes: 50,
      isVirtual: false,
      count: 4,
      intervalDays: 7,
    })

    expect(result.failures).toHaveLength(0)
    expect(result.planned).toEqual([
      { day: 1, hour: 9 },
      { day: 8, hour: 9 },
      { day: 15, hour: 9 },
      { day: 22, hour: 9 },
    ])
  })

  it('shifts subsequent occurrences to the closest available hour on the same day', () => {
    const therapist = createTherapist()
    const client = createClient()

    const existing = createSession({
      id: 'existing',
      therapistId: therapist.id,
      clientId: 'other-client',
      scheduledDay: 8,
      scheduledHour: 9,
    })

    const sessions = [existing]
    const schedule = ScheduleManager.buildScheduleFromSessions(sessions)

    const result = planRecurringBookings({
      schedule,
      sessions,
      therapist,
      client,
      building,
      telehealthUnlocked: true,
      currentTime: { day: 1, hour: 8, minute: 0 },
      startDay: 1,
      startHour: 9,
      durationMinutes: 50,
      isVirtual: false,
      count: 2,
      intervalDays: 7,
    })

    expect(result.failures).toHaveLength(0)
    expect(result.planned[0]).toEqual({ day: 1, hour: 9 })
    expect(result.planned[1].day).toBe(8)
    expect(result.planned[1].hour).not.toBe(9)
  })

  it('fails when room capacity prevents the first occurrence', () => {
    const therapist = createTherapist({ id: 't1' })
    const client = createClient({ id: 'c1' })

    const fullBuilding: Building = { ...building, rooms: 1 }
    const occupyingSession = createSession({
      id: 'occupy',
      therapistId: 't2',
      clientId: 'c2',
      scheduledDay: 1,
      scheduledHour: 9,
      durationMinutes: 50,
      isVirtual: false,
      status: 'scheduled',
    })

    const sessions = [occupyingSession]
    const schedule = ScheduleManager.buildScheduleFromSessions(sessions)

    const result = planRecurringBookings({
      schedule,
      sessions,
      therapist,
      client,
      building: fullBuilding,
      telehealthUnlocked: false,
      currentTime: { day: 1, hour: 8, minute: 0 },
      startDay: 1,
      startHour: 9,
      durationMinutes: 50,
      isVirtual: false,
      count: 1,
      intervalDays: 7,
    })

    expect(result.planned).toHaveLength(0)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].reason.toLowerCase()).toContain('no rooms')
  })

  it('fails when the first occurrence is in the past', () => {
    const therapist = createTherapist()
    const client = createClient()

    const result = planRecurringBookings({
      schedule: {},
      sessions: [],
      therapist,
      client,
      building,
      telehealthUnlocked: true,
      currentTime: { day: 1, hour: 10, minute: 30 },
      startDay: 1,
      startHour: 10,
      durationMinutes: 50,
      isVirtual: false,
      count: 1,
      intervalDays: 7,
    })

    expect(result.planned).toHaveLength(0)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].reason.toLowerCase()).toContain('in progress')
  })

  it('detects client overlaps across multi-hour sessions', () => {
    const therapist = createTherapist({ id: 't1' })
    const client = createClient({ id: 'c1' })

    const clientSession = createSession({
      id: 'client-long',
      therapistId: 't2',
      clientId: client.id,
      scheduledDay: 1,
      scheduledHour: 9,
      durationMinutes: 80,
      status: 'scheduled',
    })

    const sessions = [clientSession]
    const schedule = ScheduleManager.buildScheduleFromSessions(sessions)

    const result = planRecurringBookings({
      schedule,
      sessions,
      therapist,
      client,
      building,
      telehealthUnlocked: true,
      currentTime: { day: 1, hour: 8, minute: 0 },
      startDay: 1,
      startHour: 10,
      durationMinutes: 50,
      isVirtual: false,
      count: 1,
      intervalDays: 7,
    })

    expect(result.planned).toHaveLength(0)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].reason.toLowerCase()).toContain('client')
  })
})
