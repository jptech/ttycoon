import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { SaveManager } from '@/core/engine'
import type { Client, Session, Therapist } from '@/core/types'

function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
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
    status: 'in_session',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 7, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    displayName: 'Client AB',
    conditionCategory: 'anxiety',
    conditionType: 'Generalized Anxiety',
    severity: 5,
    sessionsRequired: 10,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'in_treatment',
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
    assignedTherapistId: 'therapist-1',
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
    status: 'in_progress',
    progress: 1,
    quality: 0.8,
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

describe('Session completion persistence', () => {
  beforeEach(() => {
    localStorage.clear()

    useGameStore.setState({
      practiceName: 'Test Practice',
      currentDay: 1,
      currentHour: 10,
      currentMinute: 0,
      sessions: [],
      clients: [],
      therapists: [],
      waitingList: [],
      schedule: {},
      reputation: 20,
      balance: 5000,
      transactionHistory: [],
    })
  })

  it('persists progress/XP/reputation changes across save/load', () => {
    const therapist = createTherapist({ xp: 0, level: 1 })
    const client = createClient({ sessionsCompleted: 0, treatmentProgress: 0 })
    const session = createSession()

    useGameStore.setState({ therapists: [therapist], clients: [client], sessions: [session] })

    useGameStore.getState().completeSession(session.id)

    expect(useGameStore.getState().therapists[0].xp).toBe(27)
    expect(useGameStore.getState().clients[0].sessionsCompleted).toBe(1)
    expect(useGameStore.getState().reputation).toBe(25)

    const saved = SaveManager.save()
    expect(saved).toBe(true)

    // Reset store to ensure we're truly loading from the save.
    useGameStore.setState({
      therapists: [],
      clients: [],
      sessions: [],
      schedule: {},
      reputation: 0,
      balance: 0,
      transactionHistory: [],
    })

    const loaded = SaveManager.load()
    expect(loaded).toBe(true)

    const state = useGameStore.getState()
    expect(state.therapists.find((t) => t.id === therapist.id)?.xp).toBe(27)
    expect(state.clients.find((c) => c.id === client.id)?.sessionsCompleted).toBe(1)
    expect(state.reputation).toBe(25)
    expect(state.balance).toBe(5150)

    const loadedSession = state.sessions.find((s) => s.id === session.id)
    expect(loadedSession?.status).toBe('completed')
    expect(loadedSession?.xpGained).toBe(27)
  })
})
