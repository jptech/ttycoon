import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { getGameEngine, resetGameEngine } from '@/core/engine'
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
    therapistName: 'Dr. Test',
    clientName: 'Client Test',
    ...overrides,
  }
}

describe('GameEngine skip-time guardrails', () => {
  beforeEach(() => {
    resetGameEngine()

    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      sessions: [],
      schedule: {},
    })
  })

  it('prevents skipping while any session is in progress', () => {
    const engine = getGameEngine({ tickRateMs: 100 })

    useGameStore.setState({
      sessions: [createSession({ status: 'in_progress', scheduledHour: 8 })],
    })

    expect(engine.skipToNextSession()).toBe(false)
    expect(engine.skipTo({ day: 1, hour: 9, minute: 0 })).toBeNull()
  })

  it('prevents skipping past the next scheduled session start', () => {
    const engine = getGameEngine({ tickRateMs: 100 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      sessions: [createSession({ id: 's-1', scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })],
    })

    const result = engine.skipTo({ day: 1, hour: 10, minute: 0 })
    expect(result).toBeNull()

    const state = useGameStore.getState()
    expect(state.currentDay).toBe(1)
    expect(state.currentHour).toBe(8)
    expect(state.currentMinute).toBe(0)
  })

  it('starts sessions when skipping to the exact session start time', () => {
    const onSessionStart = vi.fn()
    const engine = getGameEngine({ tickRateMs: 100, onSessionStart })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 30,
      sessions: [createSession({ id: 's-1', scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })],
    })

    const result = engine.skipTo({ day: 1, hour: 9, minute: 0 })

    expect(result).not.toBeNull()
    expect(onSessionStart).toHaveBeenCalledWith('s-1')

    const state = useGameStore.getState()
    expect(state.currentHour).toBe(9)
    expect(state.currentMinute).toBe(0)
  })

  it('does not advance time if a session is scheduled to start now (but does start it)', () => {
    const onSessionStart = vi.fn()
    const engine = getGameEngine({ tickRateMs: 100, onSessionStart })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 9,
      currentMinute: 0,
      sessions: [createSession({ id: 's-now', scheduledDay: 1, scheduledHour: 9, status: 'scheduled' })],
    })

    const skipped = engine.skipToNextSession()
    expect(skipped).toBe(true)
    expect(onSessionStart).toHaveBeenCalledWith('s-now')

    const state = useGameStore.getState()
    expect(state.currentHour).toBe(9)
    expect(state.currentMinute).toBe(0)
  })

  it('clamps skipTo beyond next-day start when no sessions remain today', () => {
    const engine = getGameEngine({ tickRateMs: 100 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 16,
      currentMinute: 30,
      sessions: [createSession({ id: 's-future', scheduledDay: 3, scheduledHour: 9, status: 'scheduled' })],
    })

    const result = engine.skipTo({ day: 3, hour: 9, minute: 0 })
    expect(result).not.toBeNull()

    const state = useGameStore.getState()
    expect(state.currentDay).toBe(2)
    expect(state.currentHour).toBe(8)
    expect(state.currentMinute).toBe(0)
  })

  it('skipToNextSession goes to next-day start when no sessions remain today', () => {
    const engine = getGameEngine({ tickRateMs: 100 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 16,
      currentMinute: 30,
      sessions: [createSession({ id: 's-future', scheduledDay: 3, scheduledHour: 9, status: 'scheduled' })],
    })

    expect(engine.skipToNextSession()).toBe(true)

    const state = useGameStore.getState()
    expect(state.currentDay).toBe(2)
    expect(state.currentHour).toBe(8)
    expect(state.currentMinute).toBe(0)
  })

  it('skipToNextSession goes to next-day start on an empty day (no sessions scheduled)', () => {
    const engine = getGameEngine({ tickRateMs: 100 })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 10,
      currentMinute: 15,
      sessions: [],
    })

    expect(engine.skipToNextSession()).toBe(true)

    const state = useGameStore.getState()
    expect(state.currentDay).toBe(2)
    expect(state.currentHour).toBe(8)
    expect(state.currentMinute).toBe(0)
  })

  it('invokes onTimeAdvance when skipping time', () => {
    const onTimeAdvance = vi.fn()
    const engine = getGameEngine({ tickRateMs: 100, onTimeAdvance })

    useGameStore.setState({
      currentDay: 1,
      currentHour: 16,
      currentMinute: 30,
      sessions: [createSession({ id: 's-future', scheduledDay: 3, scheduledHour: 9, status: 'scheduled' })],
    })

    expect(engine.skipToNextSession()).toBe(true)
    expect(onTimeAdvance).toHaveBeenCalledTimes(1)

    const result = onTimeAdvance.mock.calls[0][0]
    expect(result.previousTime).toEqual({ day: 1, hour: 16, minute: 30 })
    expect(result.newTime).toEqual({ day: 2, hour: 8, minute: 0 })
  })
})
