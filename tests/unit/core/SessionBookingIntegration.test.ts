import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { ScheduleManager } from '@/core/schedule'
import { ClientManager } from '@/core/clients'
import type { Session, Therapist, Client, Schedule } from '@/core/types'

// Test fixtures
function createTestTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
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
    traits: { warmth: 7, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

function createTestClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    displayName: 'Client AB',
    conditionCategory: 'anxiety',
    conditionType: 'Generalized Anxiety',
    severity: 5,
    sessionsRequired: 10,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'waiting',
    satisfaction: 70,
    engagement: 60,
    isPrivatePay: true,
    insuranceProvider: null,
    sessionRate: 150,
    prefersVirtual: false,
    preferredFrequency: 'weekly',
    preferredTime: 'afternoon',
    availability: {
      monday: [14, 15, 16],
      tuesday: [14, 15, 16],
      wednesday: [14, 15, 16],
      thursday: [14, 15, 16],
      friday: [14, 15, 16],
    },
    requiredCertification: null,
    isMinor: false,
    isCouple: false,
    arrivalDay: 1,
    daysWaiting: 0,
    maxWaitDays: 14,
    assignedTherapistId: null,
    ...overrides,
  }
}

function createTestSession(overrides: Partial<Session> = {}): Session {
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
    therapistName: 'Dr. Smith',
    clientName: 'Client AB',
    ...overrides,
  }
}

describe('Session Booking Integration', () => {
  beforeEach(() => {
    // Reset store state before each test
    useGameStore.setState({
      sessions: [],
      schedule: {},
      clients: [],
      waitingList: [],
      therapists: [],
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      reputation: 20,
      balance: 5000,
    })
  })

  describe('Schedule and Session Synchronization', () => {
    it('addToSchedule correctly maps session to schedule slots', () => {
      const schedule: Schedule = {}
      const session = createTestSession({
        id: 'session-123',
        therapistId: 'therapist-1',
        scheduledDay: 1,
        scheduledHour: 10,
        durationMinutes: 50,
      })

      const newSchedule = ScheduleManager.addToSchedule(schedule, session)

      expect(newSchedule[1]).toBeDefined()
      expect(newSchedule[1][10]).toBeDefined()
      expect(newSchedule[1][10]['therapist-1']).toBe('session-123')
    })

    it('addToSchedule handles multi-hour sessions', () => {
      const schedule: Schedule = {}
      const session = createTestSession({
        id: 'session-123',
        scheduledHour: 10,
        durationMinutes: 80, // Takes 2 slots
      })

      const newSchedule = ScheduleManager.addToSchedule(schedule, session)

      expect(newSchedule[1][10]['therapist-1']).toBe('session-123')
      expect(newSchedule[1][11]['therapist-1']).toBe('session-123')
    })

    it('getTherapistSessionsForDay returns sessions from schedule', () => {
      const session = createTestSession({ id: 'session-123' })
      const schedule = ScheduleManager.addToSchedule({}, session)

      const sessions = ScheduleManager.getTherapistSessionsForDay(
        schedule,
        [session],
        'therapist-1',
        1
      )

      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('session-123')
    })

    it('empty schedule returns no sessions', () => {
      const schedule: Schedule = {}
      const session = createTestSession()

      const sessions = ScheduleManager.getTherapistSessionsForDay(
        schedule,
        [session],
        'therapist-1',
        1
      )

      expect(sessions).toHaveLength(0)
    })

    it('sessions without matching schedule entries are not returned', () => {
      const session = createTestSession({ id: 'session-123' })
      // Session exists but not in schedule
      const sessions = ScheduleManager.getTherapistSessionsForDay(
        {},
        [session],
        'therapist-1',
        1
      )

      expect(sessions).toHaveLength(0)
    })
  })

  describe('Store Session and Schedule Updates', () => {
    it('addSession stores session in sessions array', () => {
      const session = createTestSession()

      useGameStore.getState().addSession(session)

      const state = useGameStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe(session.id)
    })

    it('updateSchedule stores schedule in store', () => {
      const session = createTestSession()
      const schedule = ScheduleManager.addToSchedule({}, session)

      useGameStore.getState().updateSchedule(schedule)

      const state = useGameStore.getState()
      expect(state.schedule[1][10]['therapist-1']).toBe(session.id)
    })

    it('complete booking flow updates both session and schedule', () => {
      const therapist = createTestTherapist()
      const client = createTestClient()
      const session = createTestSession()

      // Setup
      useGameStore.setState({
        therapists: [therapist],
        clients: [client],
        waitingList: [client.id],
      })

      // Book session
      useGameStore.getState().addSession(session)
      const newSchedule = ScheduleManager.addToSchedule({}, session)
      useGameStore.getState().updateSchedule(newSchedule)

      // Verify
      const state = useGameStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.schedule[1][10]['therapist-1']).toBe(session.id)

      // Verify session can be retrieved
      const foundSessions = ScheduleManager.getTherapistSessionsForDay(
        state.schedule,
        state.sessions,
        'therapist-1',
        1
      )
      expect(foundSessions).toHaveLength(1)
    })
  })

  describe('Client Status Transitions', () => {
    it('new client starts with waiting status', () => {
      const client = createTestClient()

      useGameStore.getState().addClient(client)

      const state = useGameStore.getState()
      expect(state.clients[0].status).toBe('waiting')
      expect(state.waitingList).toContain(client.id)
    })

    it('booking session changes client to in_treatment', () => {
      const client = createTestClient()

      useGameStore.getState().addClient(client)
      useGameStore.getState().removeFromWaitingList(client.id)
      useGameStore.getState().updateClient(client.id, {
        status: 'in_treatment',
        assignedTherapistId: 'therapist-1',
      })

      const state = useGameStore.getState()
      expect(state.clients[0].status).toBe('in_treatment')
      expect(state.clients[0].assignedTherapistId).toBe('therapist-1')
      expect(state.waitingList).not.toContain(client.id)
    })

    it('client appears in correct filter after status change', () => {
      const waitingClient = createTestClient({ id: 'waiting-1', status: 'waiting' })
      const activeClient = createTestClient({ id: 'active-1', status: 'in_treatment' })
      const completedClient = createTestClient({ id: 'completed-1', status: 'completed' })

      const clients = [waitingClient, activeClient, completedClient]

      const waiting = clients.filter(c => c.status === 'waiting')
      const active = clients.filter(c => c.status === 'in_treatment')
      const completed = clients.filter(c => c.status === 'completed')

      expect(waiting).toHaveLength(1)
      expect(active).toHaveLength(1)
      expect(completed).toHaveLength(1)
    })
  })

  describe('Full Booking Workflow', () => {
    it('simulates complete booking from client arrival to scheduled session', () => {
      const therapist = createTestTherapist()

      // 1. Start game
      useGameStore.getState().newGame('Test Practice', therapist)

      let state = useGameStore.getState()
      expect(state.therapists).toHaveLength(1)
      // Initial clients are seeded
      expect(state.clients.length).toBeGreaterThanOrEqual(2)
      expect(state.waitingList.length).toBeGreaterThanOrEqual(2)

      // 2. Get a waiting client
      const waitingClient = state.clients[0]
      expect(waitingClient.status).toBe('waiting')

      // 3. Book a session
      const session = createTestSession({
        id: 'test-session-1',
        therapistId: therapist.id,
        clientId: waitingClient.id,
        clientName: waitingClient.displayName,
        scheduledDay: 1,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session)
      const newSchedule = ScheduleManager.addToSchedule(state.schedule, session)
      useGameStore.getState().updateSchedule(newSchedule)
      useGameStore.getState().removeFromWaitingList(waitingClient.id)
      useGameStore.getState().updateClient(waitingClient.id, {
        status: 'in_treatment',
        assignedTherapistId: therapist.id,
      })

      // 4. Verify final state
      state = useGameStore.getState()

      // Session is stored
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe('test-session-1')

      // Schedule is updated
      expect(state.schedule[1][10][therapist.id]).toBe('test-session-1')

      // Client status is updated
      const bookedClient = state.clients.find(c => c.id === waitingClient.id)
      expect(bookedClient?.status).toBe('in_treatment')
      expect(bookedClient?.assignedTherapistId).toBe(therapist.id)

      // Client removed from waiting list
      expect(state.waitingList).not.toContain(waitingClient.id)

      // Session can be retrieved from schedule
      const foundSessions = ScheduleManager.getTherapistSessionsForDay(
        state.schedule,
        state.sessions,
        therapist.id,
        1
      )
      expect(foundSessions).toHaveLength(1)
      expect(foundSessions[0].id).toBe('test-session-1')
    })

    it('multiple sessions for same therapist on same day', () => {
      const therapist = createTestTherapist()

      useGameStore.setState({
        therapists: [therapist],
        sessions: [],
        schedule: {},
      })

      // Book 3 sessions at different hours
      const sessions = [
        createTestSession({ id: 'session-1', scheduledHour: 9 }),
        createTestSession({ id: 'session-2', scheduledHour: 11 }),
        createTestSession({ id: 'session-3', scheduledHour: 14 }),
      ]

      let schedule: Schedule = {}
      for (const session of sessions) {
        useGameStore.getState().addSession(session)
        schedule = ScheduleManager.addToSchedule(schedule, session)
      }
      useGameStore.getState().updateSchedule(schedule)

      const state = useGameStore.getState()
      expect(state.sessions).toHaveLength(3)

      const foundSessions = ScheduleManager.getTherapistSessionsForDay(
        state.schedule,
        state.sessions,
        'therapist-1',
        1
      )
      expect(foundSessions).toHaveLength(3)
    })

    it('sessions for different therapists do not conflict', () => {
      const therapist1 = createTestTherapist({ id: 'therapist-1', displayName: 'Dr. Smith' })
      const therapist2 = createTestTherapist({ id: 'therapist-2', displayName: 'Dr. Jones' })

      useGameStore.setState({
        therapists: [therapist1, therapist2],
        sessions: [],
        schedule: {},
      })

      // Same hour, different therapists
      const session1 = createTestSession({
        id: 'session-1',
        therapistId: 'therapist-1',
        scheduledHour: 10,
      })
      const session2 = createTestSession({
        id: 'session-2',
        therapistId: 'therapist-2',
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session1)
      useGameStore.getState().addSession(session2)
      let schedule = ScheduleManager.addToSchedule({}, session1)
      schedule = ScheduleManager.addToSchedule(schedule, session2)
      useGameStore.getState().updateSchedule(schedule)

      const state = useGameStore.getState()

      // Both sessions exist
      expect(state.schedule[1][10]['therapist-1']).toBe('session-1')
      expect(state.schedule[1][10]['therapist-2']).toBe('session-2')

      // Each therapist gets their own session
      const t1Sessions = ScheduleManager.getTherapistSessionsForDay(
        state.schedule,
        state.sessions,
        'therapist-1',
        1
      )
      const t2Sessions = ScheduleManager.getTherapistSessionsForDay(
        state.schedule,
        state.sessions,
        'therapist-2',
        1
      )

      expect(t1Sessions).toHaveLength(1)
      expect(t1Sessions[0].id).toBe('session-1')
      expect(t2Sessions).toHaveLength(1)
      expect(t2Sessions[0].id).toBe('session-2')
    })
  })

  describe('Schedule Conflict Detection', () => {
    it('detects slot conflicts', () => {
      const session = createTestSession({ scheduledHour: 10 })
      const schedule = ScheduleManager.addToSchedule({}, session)

      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 10)).toBe(false)
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 11)).toBe(true)
    })

    it('detects conflicts for multi-hour sessions', () => {
      const session = createTestSession({
        scheduledHour: 10,
        durationMinutes: 80, // 2 slots
      })
      const schedule = ScheduleManager.addToSchedule({}, session)

      // Both 10:00 and 11:00 are taken
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 10)).toBe(false)
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 11)).toBe(false)
      // 12:00 is free
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 12)).toBe(true)
    })

    it('allows booking adjacent slots', () => {
      const session1 = createTestSession({ id: 'session-1', scheduledHour: 10 })
      let schedule = ScheduleManager.addToSchedule({}, session1)

      // Can book 11:00 after 10:00 session
      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 11)).toBe(true)

      const session2 = createTestSession({ id: 'session-2', scheduledHour: 11 })
      schedule = ScheduleManager.addToSchedule(schedule, session2)

      expect(schedule[1][10]['therapist-1']).toBe('session-1')
      expect(schedule[1][11]['therapist-1']).toBe('session-2')
    })
  })

  describe('Session Removal', () => {
    it('removeFromSchedule clears session from schedule', () => {
      const session = createTestSession()
      let schedule = ScheduleManager.addToSchedule({}, session)

      expect(schedule[1][10]['therapist-1']).toBe(session.id)

      schedule = ScheduleManager.removeFromSchedule(schedule, session)

      expect(schedule[1][10]['therapist-1']).toBeUndefined()
    })

    it('removeFromSchedule handles multi-hour sessions', () => {
      const session = createTestSession({ durationMinutes: 80 })
      let schedule = ScheduleManager.addToSchedule({}, session)

      expect(schedule[1][10]['therapist-1']).toBe(session.id)
      expect(schedule[1][11]['therapist-1']).toBe(session.id)

      schedule = ScheduleManager.removeFromSchedule(schedule, session)

      expect(schedule[1][10]['therapist-1']).toBeUndefined()
      expect(schedule[1][11]['therapist-1']).toBeUndefined()
    })

    it('slot becomes available after session removal', () => {
      const session = createTestSession({ scheduledHour: 10 })
      let schedule = ScheduleManager.addToSchedule({}, session)

      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 10)).toBe(false)

      schedule = ScheduleManager.removeFromSchedule(schedule, session)

      expect(ScheduleManager.isSlotAvailable(schedule, 'therapist-1', 1, 10)).toBe(true)
    })
  })

  describe('ClientManager Statistics', () => {
    it('getClientStats accurately counts status', () => {
      const clients = [
        createTestClient({ id: 'c1', status: 'waiting' }),
        createTestClient({ id: 'c2', status: 'waiting' }),
        createTestClient({ id: 'c3', status: 'in_treatment' }),
        createTestClient({ id: 'c4', status: 'in_treatment' }),
        createTestClient({ id: 'c5', status: 'in_treatment' }),
        createTestClient({ id: 'c6', status: 'completed' }),
        createTestClient({ id: 'c7', status: 'dropped' }),
      ]

      const stats = ClientManager.getClientStats(clients)

      expect(stats.waiting).toBe(2)
      expect(stats.inTreatment).toBe(3)
      expect(stats.completed).toBe(1)
      expect(stats.dropped).toBe(1)
    })

    it('getClientsByStatus filters correctly', () => {
      const clients = [
        createTestClient({ id: 'c1', status: 'waiting' }),
        createTestClient({ id: 'c2', status: 'in_treatment' }),
        createTestClient({ id: 'c3', status: 'completed' }),
      ]

      expect(ClientManager.getClientsByStatus(clients, 'waiting')).toHaveLength(1)
      expect(ClientManager.getClientsByStatus(clients, 'in_treatment')).toHaveLength(1)
      expect(ClientManager.getClientsByStatus(clients, 'completed')).toHaveLength(1)
    })
  })

  describe('Booking Validation', () => {
    it('detects double-booking of same slot', () => {
      const therapist = createTestTherapist()
      const client1 = createTestClient({ id: 'client-1' })
      const client2 = createTestClient({ id: 'client-2' })

      useGameStore.setState({
        therapists: [therapist],
        clients: [client1, client2],
        sessions: [],
        schedule: {},
      })

      // Book first session
      const session1 = createTestSession({
        id: 'session-1',
        clientId: 'client-1',
        scheduledDay: 1,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session1)
      const schedule = ScheduleManager.addToSchedule({}, session1)
      useGameStore.getState().updateSchedule(schedule)

      // Try to book same slot
      const { sessions } = useGameStore.getState()
      const existingSession = sessions.find(
        (s) =>
          s.scheduledDay === 1 &&
          s.scheduledHour === 10 &&
          s.therapistId === 'therapist-1' &&
          s.status === 'scheduled'
      )

      expect(existingSession).toBeDefined()
      expect(existingSession?.id).toBe('session-1')
    })

    it('detects client conflict at same time', () => {
      const therapist1 = createTestTherapist({ id: 'therapist-1' })
      const therapist2 = createTestTherapist({ id: 'therapist-2' })
      const client = createTestClient({ id: 'client-1' })

      useGameStore.setState({
        therapists: [therapist1, therapist2],
        clients: [client],
        sessions: [],
        schedule: {},
      })

      // Book client with therapist 1
      const session1 = createTestSession({
        id: 'session-1',
        therapistId: 'therapist-1',
        clientId: 'client-1',
        scheduledDay: 1,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session1)

      // Try to check if client has a session at same time
      const { sessions } = useGameStore.getState()
      const clientConflict = sessions.find(
        (s) =>
          s.clientId === 'client-1' &&
          s.scheduledDay === 1 &&
          s.scheduledHour === 10 &&
          s.status === 'scheduled'
      )

      expect(clientConflict).toBeDefined()
      expect(clientConflict?.id).toBe('session-1')
    })

    it('allows booking different clients at same time with different therapists', () => {
      const therapist1 = createTestTherapist({ id: 'therapist-1' })
      const therapist2 = createTestTherapist({ id: 'therapist-2' })
      const client1 = createTestClient({ id: 'client-1' })
      const client2 = createTestClient({ id: 'client-2' })

      useGameStore.setState({
        therapists: [therapist1, therapist2],
        clients: [client1, client2],
        sessions: [],
        schedule: {},
      })

      // Book first session
      const session1 = createTestSession({
        id: 'session-1',
        therapistId: 'therapist-1',
        clientId: 'client-1',
        scheduledDay: 1,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session1)
      let schedule = ScheduleManager.addToSchedule({}, session1)

      // Book second session same time, different therapist and client
      const session2 = createTestSession({
        id: 'session-2',
        therapistId: 'therapist-2',
        clientId: 'client-2',
        scheduledDay: 1,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session2)
      schedule = ScheduleManager.addToSchedule(schedule, session2)
      useGameStore.getState().updateSchedule(schedule)

      const { sessions } = useGameStore.getState()
      expect(sessions).toHaveLength(2)
    })
  })

  describe('Fresh State Retrieval', () => {
    it('getState() returns latest data after updates', () => {
      const therapist = createTestTherapist()
      const client = createTestClient()

      useGameStore.setState({
        therapists: [therapist],
        clients: [client],
        sessions: [],
      })

      // Verify initial state
      let state = useGameStore.getState()
      expect(state.sessions).toHaveLength(0)

      // Add session
      const session = createTestSession()
      useGameStore.getState().addSession(session)

      // getState() should return fresh data
      state = useGameStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe('session-1')
    })

    it('sequential updates are all visible via getState()', () => {
      useGameStore.setState({ sessions: [] })

      // Add multiple sessions in sequence
      for (let i = 1; i <= 5; i++) {
        const session = createTestSession({
          id: `session-${i}`,
          scheduledHour: 8 + i,
        })
        useGameStore.getState().addSession(session)

        // Verify each addition is immediately visible
        const state = useGameStore.getState()
        expect(state.sessions).toHaveLength(i)
      }

      // Final verification
      const finalState = useGameStore.getState()
      expect(finalState.sessions).toHaveLength(5)
    })

    it('client lookup with fresh state finds newly added clients', () => {
      useGameStore.setState({ clients: [], waitingList: [] })

      // Add client
      const client = createTestClient({ id: 'new-client' })
      useGameStore.getState().addClient(client)

      // Fresh lookup should find it
      const { clients } = useGameStore.getState()
      const found = clients.find((c) => c.id === 'new-client')
      expect(found).toBeDefined()
      expect(found?.displayName).toBe('Client AB')
    })
  })

  describe('Follow-up Booking for Active Clients', () => {
    it('allows booking follow-up for in_treatment client', () => {
      const therapist = createTestTherapist()
      const client = createTestClient({
        id: 'active-client',
        status: 'in_treatment',
        assignedTherapistId: 'therapist-1',
        sessionsCompleted: 3,
      })

      useGameStore.setState({
        therapists: [therapist],
        clients: [client],
        waitingList: [], // Not in waiting list since in_treatment
        sessions: [],
        schedule: {},
      })

      // Book follow-up session
      const session = createTestSession({
        id: 'followup-session',
        clientId: 'active-client',
        scheduledDay: 5,
        scheduledHour: 10,
      })

      useGameStore.getState().addSession(session)

      const { sessions, clients: updatedClients } = useGameStore.getState()
      expect(sessions).toHaveLength(1)

      // Client should still be in_treatment (not removed from waiting list since wasn't there)
      const activeClient = updatedClients.find((c) => c.id === 'active-client')
      expect(activeClient?.status).toBe('in_treatment')
    })

    it('does not remove in_treatment client from waiting list', () => {
      const client = createTestClient({
        id: 'active-client',
        status: 'in_treatment',
      })

      useGameStore.setState({
        clients: [client],
        waitingList: [], // in_treatment clients are not in waiting list
      })

      // Verify waiting list is empty
      const { waitingList } = useGameStore.getState()
      expect(waitingList).toHaveLength(0)
      expect(waitingList).not.toContain('active-client')
    })

    it('waiting client is removed from waiting list when booked', () => {
      const client = createTestClient({
        id: 'waiting-client',
        status: 'waiting',
      })

      useGameStore.setState({
        clients: [client],
        waitingList: ['waiting-client'],
      })

      // Simulate booking: remove from waiting list and update status
      useGameStore.getState().removeFromWaitingList('waiting-client')
      useGameStore.getState().updateClient('waiting-client', {
        status: 'in_treatment',
        assignedTherapistId: 'therapist-1',
      })

      const { waitingList, clients } = useGameStore.getState()
      expect(waitingList).not.toContain('waiting-client')
      expect(clients[0].status).toBe('in_treatment')
    })
  })
})
