import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  type Session,
  type Therapist,
  type Client,
  type ActiveTraining,
  type TrainingProgram,
} from '@/core/types'
import { getSessionReputationDelta, REPUTATION_CONFIG } from '@/core/reputation'
import { useGameStore } from '@/store/gameStore'
import { useClientSpawning } from '@/hooks/useClientSpawning'
import { useTrainingProcessor } from '@/hooks/useTrainingProcessor'
import { TrainingProcessor } from '@/core/training'

describe('reputation flows', () => {
  beforeEach(() => {
    useGameStore.setState((state) => {
      state.reputation = 20
      state.practiceLevel = 1
      state.reputationLog = []
      state.sessions = []
      state.therapists = []
      state.clients = []
      state.waitingList = []
      state.activeTrainings = []
      state.currentDay = 1
      state.currentHour = 10
      state.currentMinute = 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
    id: 'therapist-1',
    displayName: 'Dr. Rivera',
    isPlayer: true,
    energy: 90,
    maxEnergy: 100,
    baseSkill: 70,
    level: 2,
    xp: 150,
    hourlySalary: 0,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 6, analytical: 5, creativity: 4 },
    ...overrides,
  })

  const createClient = (overrides: Partial<Client> = {}): Client => ({
    id: 'client-1',
    displayName: 'Client AB',
    conditionCategory: 'anxiety',
    conditionType: 'Generalized Anxiety',
    severity: 5,
    sessionsRequired: 1,
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

  const createSession = (overrides: Partial<Session> = {}): Session => ({
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
    quality: 0.8,
    qualityModifiers: [],
    payment: 150,
    energyCost: 10,
    xpGained: 0,
    decisionsMade: [],
    therapistName: 'Dr. Rivera',
    clientName: 'Client AB',
    ...overrides,
  })

  it('awards session reputation and logs treatment completion bonus', () => {
    const therapist = createTherapist()
    const client = createClient()
    const session = createSession({ quality: 0.9 })

    useGameStore.setState((state) => {
      state.therapists = [therapist]
      state.clients = [client]
      state.sessions = [session]
    })

    const startingReputation = useGameStore.getState().reputation

    const result = useGameStore.getState().completeSession(session.id)
    expect(result).not.toBeNull()

    const expectedDelta = getSessionReputationDelta(0.9)
    const curedBonus = REPUTATION_CONFIG.CLIENT_CURED_BONUS
    const finalReputation = useGameStore.getState().reputation

    expect(finalReputation).toBe(startingReputation + expectedDelta + curedBonus)

    const log = useGameStore.getState().reputationLog
    expect(log.length).toBeGreaterThanOrEqual(2)
    expect(log[0].change).toBe(curedBonus)
    expect(log[0].reason).toContain('Completed treatment')
    expect(log[1].change).toBe(expectedDelta)
  })

  it('applies penalties for poor sessions', () => {
    const therapist = createTherapist()
    const client = createClient({ sessionsRequired: 3 })
    const session = createSession({ quality: 0.2 })

    useGameStore.setState((state) => {
      state.therapists = [therapist]
      state.clients = [client]
      state.sessions = [session]
    })

    const startingReputation = useGameStore.getState().reputation

    const result = useGameStore.getState().completeSession(session.id)
    expect(result?.reputationDelta).toBeLessThan(0)

    const expectedDelta = getSessionReputationDelta(0.2)
    const finalReputation = useGameStore.getState().reputation
    expect(finalReputation).toBe(startingReputation + expectedDelta)

    const latest = useGameStore.getState().reputationLog[0]
    expect(latest.change).toBe(expectedDelta)
    expect(latest.reason).toMatch(/session/i)
  })

  it('removes reputation when clients drop from waiting list', () => {
    const client = createClient({
      id: 'client-drop',
      status: 'waiting',
      assignedTherapistId: null,
      arrivalDay: 1,
      maxWaitDays: 3,
      satisfaction: 50,
    })

    useGameStore.setState((state) => {
      state.clients = [client]
      state.waitingList = ['client-drop']
      state.reputation = 30
      state.reputationLog = []
      state.currentDay = 8
    })

    const { result } = renderHook(() => useClientSpawning({ enabled: false }))

    act(() => {
      result.current.processWaitingList()
    })

    const finalReputation = useGameStore.getState().reputation
    expect(finalReputation).toBe(30 + REPUTATION_CONFIG.CLIENT_DROPOUT_PENALTY)

    const latest = useGameStore.getState().reputationLog[0]
    expect(latest.change).toBe(REPUTATION_CONFIG.CLIENT_DROPOUT_PENALTY)
    expect(latest.reason).toBe('Client left waiting list')
  })

  it('applies training bonuses to reputation', () => {
    const therapist = createTherapist({ id: 'therapist-training', displayName: 'Dr. Business' })

    useGameStore.setState((state) => {
      state.therapists = [therapist]
      state.activeTrainings = [
        {
          programId: 'business_boost',
          therapistId: therapist.id,
          startDay: 1,
          hoursCompleted: 0,
          totalHours: 8,
        } as ActiveTraining,
      ]
      state.reputation = 40
      state.reputationLog = []
    })

    const bonusValue = 4
    const mockProgram: TrainingProgram = {
      id: 'business_boost',
      name: 'Business Boost',
      description: 'Increase clinic reputation',
      durationHours: 8,
      cost: 1000,
      track: 'business',
      grants: {
        certification: null,
        skillBonus: 0,
        clinicBonus: { type: 'reputation_bonus', value: bonusValue },
      },
    }

    vi.spyOn(TrainingProcessor, 'processDailyTraining').mockReturnValue({
      updatedTrainings: [],
      completedTrainings: [
        {
          training: {
            programId: 'business_boost',
            therapistId: therapist.id,
            startDay: 1,
            hoursCompleted: 8,
            totalHours: 8,
          } as ActiveTraining,
          program: mockProgram,
          therapistId: therapist.id,
          therapistName: therapist.displayName,
          programName: mockProgram.name,
          certificationsGained: [],
          skillGained: 0,
          clinicBonus: { type: 'reputation_bonus', value: bonusValue },
        },
      ],
      therapistUpdates: new Map(),
    })

    const { result } = renderHook(() => useTrainingProcessor({ enabled: false }))

    act(() => {
      result.current.processTrainings()
    })

    const finalReputation = useGameStore.getState().reputation
    expect(finalReputation).toBe(40 + bonusValue)

    const latest = useGameStore.getState().reputationLog[0]
    expect(latest.change).toBe(bonusValue)
    expect(latest.reason).toBe('Business Training')
  })
})
