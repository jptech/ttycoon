import { useEffect, useRef, useCallback } from 'react'
import { GameEngine, getGameEngine, type TimeAdvanceResult } from '@/core/engine'
import { useGameStore } from '@/store'
import { useUIStore } from '@/store'

interface UseGameLoopOptions {
  /** Called when time advances */
  onTimeAdvance?: (result: TimeAdvanceResult) => void
  /** Called when a session should start */
  onSessionStart?: (sessionId: string) => void
  /** Called when a session needs updating */
  onSessionTick?: (sessionId: string, deltaMinutes: number) => void
}

/**
 * Hook to manage the game loop lifecycle
 */
export function useGameLoop(options: UseGameLoopOptions = {}) {
  const engineRef = useRef<GameEngine | null>(null)
  const { pause, resume } = useGameStore()

  // Store callbacks in refs to avoid recreating engine on callback changes
  const callbacksRef = useRef(options)

  // Update ref in effect to avoid assignment during render
  useEffect(() => {
    callbacksRef.current = options
  })

  // Initialize engine on mount
  useEffect(() => {
    const engine = getGameEngine({
      tickRateMs: 100,
      onTimeAdvance: (result) => callbacksRef.current.onTimeAdvance?.(result),
      onSessionStart: (sessionId) => callbacksRef.current.onSessionStart?.(sessionId),
      onSessionTick: (sessionId, delta) => callbacksRef.current.onSessionTick?.(sessionId, delta),
    })

    engineRef.current = engine
    engine.start()

    return () => {
      engine.stop()
    }
  }, [])

  // Pause game when modal opens
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.activeModal) {
        pause(`modal_${state.activeModal.type}`)
      }
    })

    return unsubscribe
  }, [pause])

  /**
   * Skip to the next scheduled session
   */
  const skipToNextSession = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return false

    return engine.skipToNextSession()
  }, [])

  /**
   * Get the next session time
   */
  const getNextSessionTime = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return null

    return engine.getNextSessionTime()
  }, [])

  /**
   * Manually pause the game
   */
  const pauseGame = useCallback(
    (reason: string = 'manual') => {
      pause(reason)
    },
    [pause]
  )

  /**
   * Manually resume the game
   */
  const resumeGame = useCallback(
    (reason: string = 'manual') => {
      resume(reason)
    },
    [resume]
  )

  return {
    skipToNextSession,
    getNextSessionTime,
    pauseGame,
    resumeGame,
  }
}
