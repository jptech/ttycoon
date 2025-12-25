import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'

import { getGameEngine, resetGameEngine } from '@/core/engine'
import { useGameStore } from '@/store/gameStore'
import { useTherapistEnergyProcessor } from '@/hooks'
import type { Therapist, Session } from '@/core/types'

function createTherapist(id: string, overrides: Partial<Therapist> = {}): Therapist {
  return {
    id,
    displayName: `Dr. ${id}`,
    isPlayer: false,
    energy: 50,
    maxEnergy: 100,
    baseSkill: 60,
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

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    therapistId: 'therapist-1',
    clientId: 'client-1',
    sessionType: 'clinical',
    isVirtual: false,
    isInsurance: false,
    scheduledDay: 1,
    scheduledHour: 12,
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

function HookHarness(props: { onReady: (api: ReturnType<typeof useTherapistEnergyProcessor>) => void }) {
  const api = useTherapistEnergyProcessor({ enabled: true })
  useEffect(() => {
    props.onReady(api)
  }, [api, props])
  return null
}

describe('GameEngine skip triggers time-based processors (energy recovery)', () => {
  beforeEach(() => {
    resetGameEngine()
    useGameStore.setState({
      currentDay: 1,
      currentHour: 9,
      currentMinute: 0,
      therapists: [createTherapist('therapist-1', { energy: 50 })],
      sessions: [createSession({ therapistId: 'therapist-1', scheduledHour: 12 })],
      schedule: {},
    })
  })

  it('recovers idle energy for skipped minutes before starting sessions at the new time', () => {
    let api: ReturnType<typeof useTherapistEnergyProcessor> | null = null
    const view = render(<HookHarness onReady={(a) => (api = a)} />)

    // Wire the energy processor into the engine callback.
    const engine = getGameEngine({
      tickRateMs: 100,
      onTimeAdvance: (result) => api!.onTimeAdvance(result),
      // Simulate session start updating therapist status as the real app does.
      onSessionStart: (sessionId) => {
        const state = useGameStore.getState()
        const session = state.sessions.find((s) => s.id === sessionId)
        if (!session) return
        state.updateTherapist(session.therapistId, { status: 'in_session' })
      },
    })

    expect(engine.skipToNextSession()).toBe(true)

    // 9:00 -> 12:00 is 180 idle minutes; recovery rate is 10 energy/hour => +30 energy.
    const therapist = useGameStore.getState().therapists.find((t) => t.id === 'therapist-1')!
    expect(therapist.energy).toBe(80)

    view.unmount()
  })
})
