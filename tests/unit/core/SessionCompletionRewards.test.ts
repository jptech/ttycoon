import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import type { Client, Session, Therapist } from '@/core/types'

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
    status: 'in_session',
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

describe('Session completion rewards', () => {
  beforeEach(() => {
    useGameStore.setState({
      currentDay: 1,
      currentHour: 10,
      currentMinute: 0,
      sessions: [],
      clients: [],
      therapists: [],
      waitingList: [],
      reputation: 20,
      balance: 5000,
    })
  })

  it('updates client progress, therapist XP+level, money, and reputation on completion', () => {
    const therapist = createTestTherapist({ xp: 0, level: 1, energy: 100, status: 'in_session' })
    const client = createTestClient({ sessionsCompleted: 0, treatmentProgress: 0, status: 'in_treatment' })
    const session = createTestSession({ quality: 0.8, payment: 150, energyCost: 15, xpGained: 0 })

    useGameStore.setState({ therapists: [therapist], clients: [client], sessions: [session] })

    const result = useGameStore.getState().completeSession(session.id)
    expect(result).not.toBeNull()

    const state = useGameStore.getState()
    const updatedSession = state.sessions.find((s) => s.id === session.id)!
    const updatedTherapist = state.therapists.find((t) => t.id === therapist.id)!
    const updatedClient = state.clients.find((c) => c.id === client.id)!

    expect(updatedSession.status).toBe('completed')
    expect(updatedSession.progress).toBe(1)
    expect(updatedSession.completedAt).toEqual({ day: 1, hour: 10, minute: 0 })

    // XP formula: BASE_XP=10, duration=50 => 10; high-quality multiplier 1.5; (1+quality)=1.8
    // round(10 * 1.5 * 1.8) = 27
    expect(updatedSession.xpGained).toBe(27)
    expect(updatedTherapist.xp).toBe(27)
    expect(updatedTherapist.level).toBe(2)
    expect(updatedTherapist.energy).toBe(85)
    expect(updatedTherapist.status).toBe('available')

    expect(updatedClient.sessionsCompleted).toBe(1)
    expect(updatedClient.treatmentProgress).toBeCloseTo(0.08, 5)

    expect(state.balance).toBe(5150)
    expect(state.reputation).toBe(25)
  })
})
