import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import type { Session } from '@/core/types'

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
    therapistName: 'Dr. Test',
    clientName: 'Client Test',
    ...overrides,
  }
}

describe('gameStore.loadState schedule rebuild', () => {
  beforeEach(() => {
    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      sessions: [],
      schedule: {},
    })
  })

  it('rebuilds schedule from sessions even if loaded schedule is empty', () => {
    const base = useGameStore.getState().getState()

    const loadedSession = createSession({
      id: 's-1',
      therapistId: 'therapist-1',
      scheduledDay: 2,
      scheduledHour: 11,
      status: 'scheduled',
    })

    useGameStore.getState().loadState({
      ...base,
      sessions: [loadedSession],
      schedule: {},
    })

    const state = useGameStore.getState()
    expect(state.schedule[2][11]['therapist-1']).toBe('s-1')
  })

  it('rebuilds schedule for multi-hour sessions', () => {
    const base = useGameStore.getState().getState()

    const longSession = createSession({
      id: 's-long',
      therapistId: 'therapist-1',
      scheduledDay: 1,
      scheduledHour: 9,
      durationMinutes: 80,
      status: 'scheduled',
    })

    useGameStore.getState().loadState({
      ...base,
      sessions: [longSession],
      schedule: {},
    })

    const state = useGameStore.getState()
    expect(state.schedule[1][9]['therapist-1']).toBe('s-long')
    expect(state.schedule[1][10]['therapist-1']).toBe('s-long')
  })
})
