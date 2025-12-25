import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { ScheduleManager } from '@/core/schedule'
import type { Client, Therapist, Session } from '@/core/types'

function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 'therapist-1',
    displayName: 'Dr. One',
    isPlayer: false,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 1,
    xp: 0,
    hourlySalary: 50,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 5, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    displayName: 'Client One',
    conditionCategory: 'anxiety',
    conditionType: 'generalized_anxiety',
    severity: 5,
    sessionsRequired: 8,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'waiting',
    satisfaction: 50,
    engagement: 75,
    isPrivatePay: true,
    insuranceProvider: null,
    sessionRate: 150,
    prefersVirtual: false,
    preferredFrequency: 'weekly',
    preferredTime: 'morning',
    availability: {
      monday: [8, 9, 10, 11],
      tuesday: [8, 9, 10, 11],
      wednesday: [8, 9, 10, 11],
      thursday: [8, 9, 10, 11],
      friday: [8, 9, 10, 11],
    },
    requiredCertification: null,
    isMinor: false,
    isCouple: false,
    arrivalDay: 1,
    daysWaiting: 0,
    maxWaitDays: 10,
    assignedTherapistId: null,
    ...overrides,
  }
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    therapistId: 'therapist-1',
    clientId: 'client-1',
    sessionType: 'clinical',
    isVirtual: false,
    isInsurance: false,
    scheduledDay: 1,
    scheduledHour: 10,
    durationMinutes: 50,
    status: 'scheduled',
    progress: 0,
    quality: 0.5,
    qualityModifiers: [],
    payment: 150,
    energyCost: 15,
    xpGained: 0,
    decisionsMade: [],
    therapistName: 'Dr. One',
    clientName: 'Client One',
    ...overrides,
  }
}

describe('gameStore booking edits (cancel/reschedule)', () => {
  beforeEach(() => {
    const therapists = [createTherapist(), createTherapist({ id: 'therapist-2', displayName: 'Dr. Two' })]
    const clients = [createClient(), createClient({ id: 'client-2', displayName: 'Client Two' })]

    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      therapists,
      clients,
      sessions: [],
      schedule: {},
      currentBuildingId: 'starter_suite',
      telehealthUnlocked: false,
    })
  })

  it('cancels a future scheduled session and frees its slot', () => {
    const session = createSession({ id: 's-1', scheduledDay: 1, scheduledHour: 10, therapistId: 'therapist-1' })

    useGameStore.setState({
      sessions: [session],
      schedule: ScheduleManager.buildScheduleFromSessions([session]),
    })

    const result = useGameStore.getState().cancelSession('s-1')
    expect(result.success).toBe(true)

    const state = useGameStore.getState()
    expect(state.sessions.find((s) => s.id === 's-1')?.status).toBe('cancelled')

    // Cancelled sessions should not occupy schedule slots
    expect(state.schedule[1]?.[10]?.['therapist-1']).toBeUndefined()
  })

  it('rejects cancelling a session in the past', () => {
    const session = createSession({ id: 's-past', scheduledDay: 1, scheduledHour: 9 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 10,
      currentMinute: 0,
      sessions: [session],
      schedule: ScheduleManager.buildScheduleFromSessions([session]),
    })

    const result = useGameStore.getState().cancelSession('s-past')
    expect(result.success).toBe(false)

    const state = useGameStore.getState()
    expect(state.sessions.find((s) => s.id === 's-past')?.status).toBe('scheduled')
  })

  it('rejects rescheduling to a time in the past', () => {
    const session = createSession({ id: 's-1', scheduledDay: 1, scheduledHour: 10 })

    useGameStore.setState({
      sessions: [session],
      schedule: ScheduleManager.buildScheduleFromSessions([session]),
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-1',
      therapistId: 'therapist-1',
      day: 1,
      hour: 7,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(false)
  })

  it('rejects rescheduling a session that is already in the past', () => {
    const session = createSession({ id: 's-1', scheduledDay: 1, scheduledHour: 9 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 10,
      currentMinute: 0,
      sessions: [session],
      schedule: ScheduleManager.buildScheduleFromSessions([session]),
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-1',
      therapistId: 'therapist-1',
      day: 1,
      hour: 11,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(false)
  })

  it('rejects rescheduling when the target therapist slot is occupied', () => {
    const sessionToMove = createSession({ id: 's-move', therapistId: 'therapist-1', scheduledDay: 1, scheduledHour: 10 })
    const blocker = createSession({
      id: 's-block',
      therapistId: 'therapist-2',
      clientId: 'client-2',
      therapistName: 'Dr. Two',
      clientName: 'Client Two',
      scheduledDay: 1,
      scheduledHour: 11,
    })

    const all = [sessionToMove, blocker]

    useGameStore.setState({
      sessions: all,
      schedule: ScheduleManager.buildScheduleFromSessions(all),
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-move',
      therapistId: 'therapist-2',
      day: 1,
      hour: 11,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(false)
  })

  it('rejects rescheduling when it would overlap another session for the client', () => {
    const sessionToMove = createSession({ id: 's-move', clientId: 'client-1', scheduledDay: 1, scheduledHour: 10 })
    const clientConflict = createSession({
      id: 's-conflict',
      clientId: 'client-1',
      therapistId: 'therapist-2',
      therapistName: 'Dr. Two',
      scheduledDay: 1,
      scheduledHour: 11,
    })

    const all = [sessionToMove, clientConflict]

    useGameStore.setState({
      sessions: all,
      schedule: ScheduleManager.buildScheduleFromSessions(all),
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-move',
      therapistId: 'therapist-1',
      day: 1,
      hour: 11,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(false)
  })

  it('rejects rescheduling an in-person session if rooms are full', () => {
    // Starter suite has 1 room; existing in-person session blocks the room.
    const sessionToMove = createSession({ id: 's-move', therapistId: 'therapist-1', scheduledDay: 1, scheduledHour: 10 })
    const roomBlocker = createSession({
      id: 's-room',
      therapistId: 'therapist-2',
      clientId: 'client-2',
      therapistName: 'Dr. Two',
      clientName: 'Client Two',
      scheduledDay: 1,
      scheduledHour: 12,
      isVirtual: false,
    })

    const all = [sessionToMove, roomBlocker]

    useGameStore.setState({
      sessions: all,
      schedule: ScheduleManager.buildScheduleFromSessions(all),
      currentBuildingId: 'starter_suite',
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-move',
      therapistId: 'therapist-1',
      day: 1,
      hour: 12,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(false)
  })

  it('successfully reschedules and updates the schedule map', () => {
    const session = createSession({ id: 's-1', therapistId: 'therapist-1', scheduledDay: 1, scheduledHour: 10 })

    useGameStore.setState({
      sessions: [session],
      schedule: ScheduleManager.buildScheduleFromSessions([session]),
    })

    const result = useGameStore.getState().rescheduleSession({
      sessionId: 's-1',
      therapistId: 'therapist-1',
      day: 1,
      hour: 11,
      duration: 50,
      isVirtual: false,
    })

    expect(result.success).toBe(true)

    const state = useGameStore.getState()
    const updated = state.sessions.find((s) => s.id === 's-1')
    expect(updated?.scheduledHour).toBe(11)

    expect(state.schedule[1]?.[10]?.['therapist-1']).toBeUndefined()
    expect(state.schedule[1]?.[11]?.['therapist-1']).toBe('s-1')
  })
})
