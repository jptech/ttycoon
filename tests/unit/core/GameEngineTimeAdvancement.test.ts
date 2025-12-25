import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { getGameEngine, resetGameEngine } from '@/core/engine'
import { useGameStore } from '@/store/gameStore'

describe('GameEngine time advancement (requestAnimationFrame loop)', () => {
  const rafCallbacks: Array<FrameRequestCallback> = []
  let now = 0
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    resetGameEngine()
    rafCallbacks.length = 0

    now = 0
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', (_id: number) => {})

    useGameStore.setState({
      currentDay: 1,
      currentHour: 8,
      currentMinute: 0,
      gameSpeed: 1,
      isPaused: false,
      pauseReasons: [],
      sessions: [],
      schedule: {},
    })
  })

  afterEach(() => {
    resetGameEngine()
    nowSpy?.mockRestore()
    vi.unstubAllGlobals()
  })

  function runFrames(frameCount: number, stepMs: number = 100) {
    for (let i = 0; i < frameCount; i++) {
      now += stepMs
      const cb = rafCallbacks.shift()
      expect(cb).toBeTypeOf('function')
      cb!(now)
    }
  }

  it('advances minutes over time when running and unpaused', () => {
    const engine = getGameEngine({ tickRateMs: 100 })
    engine.start()

    // First loop schedules rAF callback without ticking (delta=0).
    expect(rafCallbacks.length).toBeGreaterThan(0)

    // 10 frames * 100ms @ 1x => 10 * 0.2 = 2 game minutes.
    runFrames(10, 100)

    const state = useGameStore.getState()
    expect(state.currentDay).toBe(1)
    expect(state.currentHour).toBe(8)
    expect(state.currentMinute).toBeGreaterThanOrEqual(1)
  })

  it('does not freeze if a callback throws (loop remains scheduled)', () => {
    const onTimeAdvance = vi.fn(() => {
      throw new Error('boom')
    })

    const engine = getGameEngine({ tickRateMs: 100, onTimeAdvance })
    engine.start()

    // Run enough frames to ensure at least one minute advances.
    runFrames(6, 100)

    expect(onTimeAdvance).toHaveBeenCalled()
    expect(engine.running).toBe(true)
    expect(rafCallbacks.length).toBeGreaterThan(0)

    // And time should have advanced despite the exception.
    const state = useGameStore.getState()
    expect(state.currentMinute).toBeGreaterThanOrEqual(1)
  })
})
