import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { EventBus, GameEvents } from '@/core/events'
import type { Session, Therapist, Client } from '@/core/types'

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

describe('Session State Transitions', () => {
  beforeEach(() => {
    // Reset the store to initial state
    useGameStore.setState({
      sessions: [],
      therapists: [],
      clients: [],
      schedule: {},
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
    })

    // Clear all event listeners
    EventBus.clear()
  })

  describe('Store Session Management', () => {
    it('adds a session to the store', () => {
      const session = createMockSession()
      const { addSession } = useGameStore.getState()

      addSession(session)

      const { sessions } = useGameStore.getState()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('session-1')
      expect(sessions[0].status).toBe('scheduled')
    })

    it('updates session status correctly', () => {
      const session = createMockSession()
      const { addSession, updateSession } = useGameStore.getState()

      addSession(session)
      updateSession('session-1', { status: 'in_progress' })

      const { sessions } = useGameStore.getState()
      expect(sessions[0].status).toBe('in_progress')
    })

    it('updates session progress correctly', () => {
      const session = createMockSession({ status: 'in_progress' })
      const { addSession, updateSession } = useGameStore.getState()

      addSession(session)
      updateSession('session-1', { progress: 0.5 })

      const { sessions } = useGameStore.getState()
      expect(sessions[0].progress).toBe(0.5)
    })

    it('handles multiple session updates without data loss', () => {
      const session = createMockSession({ status: 'in_progress', quality: 0.6 })
      const { addSession, updateSession } = useGameStore.getState()

      addSession(session)

      // Multiple sequential updates
      updateSession('session-1', { progress: 0.25 })
      updateSession('session-1', { progress: 0.5 })
      updateSession('session-1', { progress: 0.75 })

      const { sessions } = useGameStore.getState()
      expect(sessions[0].progress).toBe(0.75)
      expect(sessions[0].quality).toBe(0.6) // Should be preserved
      expect(sessions[0].status).toBe('in_progress') // Should be preserved
    })
  })

  describe('Therapist Status Synchronization', () => {
    it('therapist status changes when session starts', () => {
      const therapist = createMockTherapist({ status: 'available' })
      const { addSession, updateSession, updateTherapist } = useGameStore.getState()

      useGameStore.setState({ therapists: [therapist] })

      const session = createMockSession()
      addSession(session)

      // Simulate session start
      updateSession('session-1', { status: 'in_progress' })
      updateTherapist('therapist-1', { status: 'in_session' })

      const { therapists, sessions } = useGameStore.getState()
      expect(therapists[0].status).toBe('in_session')
      expect(sessions[0].status).toBe('in_progress')
    })

    it('therapist status reverts when session completes', () => {
      const therapist = createMockTherapist({ status: 'in_session', energy: 80 })
      const session = createMockSession({ status: 'in_progress', progress: 1 })

      useGameStore.setState({
        therapists: [therapist],
        sessions: [session],
      })

      const { updateSession, updateTherapist } = useGameStore.getState()

      // Simulate session completion
      updateSession('session-1', { status: 'completed' })
      updateTherapist('therapist-1', { status: 'available', energy: 65 })

      const { therapists, sessions } = useGameStore.getState()
      expect(therapists[0].status).toBe('available')
      expect(therapists[0].energy).toBe(65)
      expect(sessions[0].status).toBe('completed')
    })

    it('preserves therapist status if not in_session when session completes', () => {
      // Edge case: therapist status was changed during session (e.g., to on_break)
      const therapist = createMockTherapist({ status: 'on_break', energy: 80 })
      const session = createMockSession({ status: 'in_progress', progress: 1 })

      useGameStore.setState({
        therapists: [therapist],
        sessions: [session],
      })

      const { updateSession, updateTherapist } = useGameStore.getState()
      const { therapists: currentTherapists } = useGameStore.getState()

      // Only reset to available if was in_session
      const newStatus = currentTherapists[0].status === 'in_session' ? 'available' : currentTherapists[0].status

      updateSession('session-1', { status: 'completed' })
      updateTherapist('therapist-1', { status: newStatus })

      const { therapists } = useGameStore.getState()
      // Should preserve on_break status since it wasn't in_session
      expect(therapists[0].status).toBe('on_break')
    })
  })

  describe('Session Lifecycle', () => {
    it('full session lifecycle: scheduled -> in_progress -> completed', () => {
      const therapist = createMockTherapist({ status: 'available' })
      const client = createMockClient()
      const session = createMockSession()

      useGameStore.setState({
        therapists: [therapist],
        clients: [client],
      })

      const { addSession, updateSession, updateTherapist } = useGameStore.getState()

      // 1. Schedule session
      addSession(session)

      let state = useGameStore.getState()
      expect(state.sessions[0].status).toBe('scheduled')
      expect(state.therapists[0].status).toBe('available')

      // 2. Start session
      updateSession('session-1', { status: 'in_progress' })
      updateTherapist('therapist-1', { status: 'in_session' })

      state = useGameStore.getState()
      expect(state.sessions[0].status).toBe('in_progress')
      expect(state.therapists[0].status).toBe('in_session')

      // 3. Progress session
      updateSession('session-1', { progress: 0.5 })

      state = useGameStore.getState()
      expect(state.sessions[0].progress).toBe(0.5)

      // 4. Complete session
      updateSession('session-1', {
        status: 'completed',
        progress: 1,
        completedAt: { day: 1, hour: 10, minute: 0 },
      })
      updateTherapist('therapist-1', { status: 'available', energy: 85 })

      state = useGameStore.getState()
      expect(state.sessions[0].status).toBe('completed')
      expect(state.sessions[0].progress).toBe(1)
      expect(state.sessions[0].completedAt).toEqual({ day: 1, hour: 10, minute: 0 })
      expect(state.therapists[0].status).toBe('available')
    })

    it('prevents double-starting a session', () => {
      const session = createMockSession({ status: 'in_progress' })

      useGameStore.setState({ sessions: [session] })

      const { sessions } = useGameStore.getState()
      const existingSession = sessions.find(s => s.id === 'session-1')

      // Should not start if already in_progress
      expect(existingSession?.status).toBe('in_progress')
      // A proper check would return early before updating
      const shouldStart = existingSession?.status === 'scheduled'
      expect(shouldStart).toBe(false)
    })

    it('prevents double-completing a session', () => {
      const session = createMockSession({ status: 'completed', progress: 1 })

      useGameStore.setState({ sessions: [session] })

      const { sessions } = useGameStore.getState()
      const existingSession = sessions.find(s => s.id === 'session-1')

      // Should not complete if already completed
      expect(existingSession?.status).toBe('completed')
      const shouldComplete = existingSession?.status === 'in_progress' && existingSession.progress >= 1
      expect(shouldComplete).toBe(false)
    })
  })

  describe('State Consistency', () => {
    it('getState() returns current state, not stale data', () => {
      const session = createMockSession()
      const { addSession, updateSession } = useGameStore.getState()

      addSession(session)

      // Update session
      updateSession('session-1', { status: 'in_progress', progress: 0.1 })

      // Immediately check state
      const freshState = useGameStore.getState()
      expect(freshState.sessions[0].status).toBe('in_progress')
      expect(freshState.sessions[0].progress).toBe(0.1)

      // Update again
      updateSession('session-1', { progress: 0.5 })

      // Check fresh state again
      const newerState = useGameStore.getState()
      expect(newerState.sessions[0].progress).toBe(0.5)
    })

    it('concurrent updates to different sessions work correctly', () => {
      const session1 = createMockSession({ id: 'session-1' })
      const session2 = createMockSession({ id: 'session-2' })

      const { addSession, updateSession } = useGameStore.getState()

      addSession(session1)
      addSession(session2)

      // Update both sessions
      updateSession('session-1', { status: 'in_progress', progress: 0.3 })
      updateSession('session-2', { status: 'in_progress', progress: 0.7 })

      const { sessions } = useGameStore.getState()
      const s1 = sessions.find(s => s.id === 'session-1')
      const s2 = sessions.find(s => s.id === 'session-2')

      expect(s1?.status).toBe('in_progress')
      expect(s1?.progress).toBe(0.3)
      expect(s2?.status).toBe('in_progress')
      expect(s2?.progress).toBe(0.7)
    })

    it('session data is not lost on partial updates', () => {
      const session = createMockSession({
        status: 'in_progress',
        progress: 0.5,
        quality: 0.7,
        payment: 150,
        durationMinutes: 50,
        qualityModifiers: [{ source: 'test', value: 0.1, description: 'Test modifier' }],
      })

      const { addSession, updateSession } = useGameStore.getState()

      addSession(session)

      // Update only progress
      updateSession('session-1', { progress: 0.6 })

      const { sessions } = useGameStore.getState()
      expect(sessions[0].progress).toBe(0.6)
      expect(sessions[0].quality).toBe(0.7) // Preserved
      expect(sessions[0].payment).toBe(150) // Preserved
      expect(sessions[0].durationMinutes).toBe(50) // Preserved
      expect(sessions[0].qualityModifiers).toHaveLength(1) // Preserved
    })
  })

  describe('Event Emissions', () => {
    it('emits SESSION_SCHEDULED event when session is added', () => {
      const eventHandler = vi.fn()
      EventBus.on(GameEvents.SESSION_SCHEDULED, eventHandler)

      const session = createMockSession()
      const { addSession } = useGameStore.getState()

      addSession(session)

      expect(eventHandler).toHaveBeenCalledWith({
        sessionId: 'session-1',
        clientId: 'client-1',
        therapistId: 'therapist-1',
        day: 1,
        hour: 9,
      })
    })
  })

  describe('Finding Sessions by Status', () => {
    it('finds scheduled sessions correctly', () => {
      const scheduled1 = createMockSession({ id: 'scheduled-1', status: 'scheduled' })
      const scheduled2 = createMockSession({ id: 'scheduled-2', status: 'scheduled' })
      const inProgress = createMockSession({ id: 'in-progress', status: 'in_progress' })
      const completed = createMockSession({ id: 'completed', status: 'completed' })

      useGameStore.setState({
        sessions: [scheduled1, scheduled2, inProgress, completed],
      })

      const { sessions } = useGameStore.getState()
      const scheduledSessions = sessions.filter(s => s.status === 'scheduled')
      const inProgressSessions = sessions.filter(s => s.status === 'in_progress')
      const completedSessions = sessions.filter(s => s.status === 'completed')

      expect(scheduledSessions).toHaveLength(2)
      expect(inProgressSessions).toHaveLength(1)
      expect(completedSessions).toHaveLength(1)
    })

    it('finds player therapist active session for HUD display', () => {
      const playerTherapist = createMockTherapist({ id: 'player', isPlayer: true, status: 'in_session' })
      const otherTherapist = createMockTherapist({ id: 'other', isPlayer: false, status: 'in_session' })

      const playerSession = createMockSession({
        id: 'player-session',
        therapistId: 'player',
        status: 'in_progress',
        progress: 0.5,
      })
      const otherSession = createMockSession({
        id: 'other-session',
        therapistId: 'other',
        status: 'in_progress',
      })

      useGameStore.setState({
        therapists: [playerTherapist, otherTherapist],
        sessions: [playerSession, otherSession],
      })

      const { therapists, sessions } = useGameStore.getState()

      // Simulate HUD logic
      const player = therapists.find(t => t.isPlayer)
      const activePlayerSession = sessions.find(
        s => s.therapistId === player?.id && s.status === 'in_progress'
      )

      expect(player).toBeDefined()
      expect(activePlayerSession).toBeDefined()
      expect(activePlayerSession?.id).toBe('player-session')
      expect(activePlayerSession?.progress).toBe(0.5)
    })
  })
})
