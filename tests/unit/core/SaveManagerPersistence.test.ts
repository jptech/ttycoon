import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { SaveManager } from '@/core/engine'
import type { Client, Session } from '@/core/types'

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
    status: 'completed',
    progress: 1,
    quality: 0.8,
    qualityModifiers: [],
    payment: 150,
    energyCost: 15,
    xpGained: 25,
    decisionsMade: [],
    therapistName: 'Dr. Test',
    clientName: 'Client AB',
    completedAt: { day: 1, hour: 10, minute: 50 },
    ...overrides,
  }
}

describe('SaveManager persistence rules', () => {
  beforeEach(() => {
    useGameStore.setState({
      currentDay: 30,
      currentHour: 12,
      currentMinute: 0,
      clients: [],
      sessions: [],
      schedule: {},
    })
  })

  it('keeps all past sessions for active clients, but prunes old sessions for inactive clients', () => {
    const activeClient = createClient({ id: 'client-active', status: 'in_treatment' })
    const inactiveClient = createClient({ id: 'client-inactive', status: 'completed' })

    const oldForActive = createSession({
      id: 's-old-active',
      clientId: activeClient.id,
      scheduledDay: 1,
      scheduledHour: 9,
      status: 'completed',
    })

    const oldForInactive = createSession({
      id: 's-old-inactive',
      clientId: inactiveClient.id,
      scheduledDay: 1,
      scheduledHour: 10,
      status: 'completed',
    })

    const recentForInactive = createSession({
      id: 's-recent-inactive',
      clientId: inactiveClient.id,
      scheduledDay: 20,
      scheduledHour: 11,
      status: 'completed',
    })

    const futureForInactive = createSession({
      id: 's-future-inactive',
      clientId: inactiveClient.id,
      scheduledDay: 35,
      scheduledHour: 9,
      status: 'scheduled',
      progress: 0,
      completedAt: undefined,
    })

    useGameStore.setState({
      clients: [activeClient, inactiveClient],
      sessions: [oldForActive, oldForInactive, recentForInactive, futureForInactive],
      schedule: {},
    })

    const fullState = useGameStore.getState().getState()
    const serialized = SaveManager.serializeState(fullState)

    const savedIds = new Set(serialized.sessions.map((s) => s.id))
    expect(savedIds.has('s-old-active')).toBe(true)
    expect(savedIds.has('s-recent-inactive')).toBe(true)
    expect(savedIds.has('s-future-inactive')).toBe(true)
    expect(savedIds.has('s-old-inactive')).toBe(false)

    // Schedule persistence window: past ~14 days and near-future.
    // Current day is 30 -> keep days >= 16; day 1 should not be present in schedule.
    expect(serialized.schedule[1]).toBeUndefined()

    // Recent completed session should be represented in schedule.
    expect(serialized.schedule[20][11]['therapist-1']).toBe('s-recent-inactive')

    // Future scheduled session should be represented in schedule.
    expect(serialized.schedule[35][9]['therapist-1']).toBe('s-future-inactive')
  })
})
