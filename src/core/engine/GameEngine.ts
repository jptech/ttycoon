import { useGameStore } from '@/store/gameStore'
import { EventBus, GameEvents } from '@/core/events'
import { TimeController, TIME_CONFIG, type TimeAdvanceResult } from './TimeController'
import type { GameTime } from '@/core/types'

/**
 * Configuration for the game engine
 */
export interface GameEngineConfig {
  /** Target tick rate in milliseconds (default: 100ms = 10 ticks/second) */
  tickRateMs: number
  /** Callback when time advances */
  onTimeAdvance?: (result: TimeAdvanceResult) => void
  /** Callback when a session should start */
  onSessionStart?: (sessionId: string) => void
  /** Callback when a session should update */
  onSessionTick?: (sessionId: string, deltaMinutes: number) => void
}

const DEFAULT_CONFIG: GameEngineConfig = {
  tickRateMs: 100,
}

/**
 * GameEngine orchestrates the main game loop using requestAnimationFrame.
 * It manages time advancement, session updates, and game state synchronization.
 */
export class GameEngine {
  private config: GameEngineConfig
  private animationFrameId: number | null = null
  private lastTickTime: number = 0
  private accumulatedTime: number = 0
  private isRunning: boolean = false

  constructor(config: Partial<GameEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.lastTickTime = performance.now()
    this.accumulatedTime = 0
    this.loop()

    console.log('[GameEngine] Started')
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.isRunning) return

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.isRunning = false
    console.log('[GameEngine] Stopped')
  }

  /**
   * Check if the engine is currently running
   */
  get running(): boolean {
    return this.isRunning
  }

  /**
   * Main game loop using requestAnimationFrame
   */
  private loop = (): void => {
    if (!this.isRunning) return

    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastTickTime

    // Only tick if enough time has passed
    if (deltaTime >= this.config.tickRateMs) {
      this.tick(deltaTime)
      this.lastTickTime = currentTime
    }

    this.animationFrameId = requestAnimationFrame(this.loop)
  }

  /**
   * Process a single game tick
   */
  private tick(deltaTimeMs: number): void {
    const store = useGameStore.getState()
    const { gameSpeed, isPaused, currentDay, currentHour, currentMinute } = store

    // Don't advance if paused
    if (isPaused || gameSpeed === 0) {
      return
    }

    // Calculate how many game minutes to advance
    const { minutes, remainingAccumulated } = TimeController.calculateMinutesToAdvance(
      deltaTimeMs,
      gameSpeed,
      this.accumulatedTime
    )

    this.accumulatedTime = remainingAccumulated

    // Advance time if we have whole minutes
    if (minutes > 0) {
      const currentTime: GameTime = { day: currentDay, hour: currentHour, minute: currentMinute }
      const result = TimeController.advanceMinutes(currentTime, minutes)

      // Update store with new time
      this.applyTimeAdvance(result)

      // Process game systems
      this.processActiveSessions(minutes)
      this.checkSessionStarts(result.newTime)

      // Notify callback
      this.config.onTimeAdvance?.(result)
    }
  }

  /**
   * Apply time advance result to the store
   */
  private applyTimeAdvance(result: TimeAdvanceResult): void {
    // Update time in store
    useGameStore.setState({
      currentDay: result.newTime.day,
      currentHour: result.newTime.hour,
      currentMinute: result.newTime.minute,
    })

    // Emit events
    if (result.dayEnded) {
      EventBus.emit(GameEvents.DAY_ENDED, { dayNumber: result.previousTime.day })
    }

    if (result.dayStarted) {
      EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: result.newTime.day })
    }

    if (result.hourChanged) {
      EventBus.emit(GameEvents.HOUR_CHANGED, {
        hour: result.newTime.hour,
        isInitial: false,
      })
    }

    if (result.minuteChanged) {
      EventBus.emit(GameEvents.MINUTE_CHANGED, { minute: result.newTime.minute })
    }
  }

  /**
   * Process active sessions (update progress)
   */
  private processActiveSessions(deltaMinutes: number): void {
    const { sessions } = useGameStore.getState()

    const activeSessions = sessions.filter((s) => s.status === 'in_progress')

    for (const session of activeSessions) {
      this.config.onSessionTick?.(session.id, deltaMinutes)
    }
  }

  /**
   * Check if any scheduled sessions should start
   */
  private checkSessionStarts(currentTime: GameTime): void {
    const { sessions } = useGameStore.getState()

    const sessionsToStart = sessions.filter(
      (s) =>
        s.status === 'scheduled' &&
        s.scheduledDay === currentTime.day &&
        s.scheduledHour === currentTime.hour &&
        currentTime.minute === 0 // Sessions start at the top of the hour
    )

    for (const session of sessionsToStart) {
      this.config.onSessionStart?.(session.id)
    }
  }

  /**
   * Skip time to a target (e.g., next session)
   */
  skipTo(targetTime: GameTime): TimeAdvanceResult | null {
    const store = useGameStore.getState()
    const { sessions } = store

    // Can't skip while any session is active.
    if (sessions.some((s) => s.status === 'in_progress')) {
      return null
    }

    const currentTime: GameTime = {
      day: store.currentDay,
      hour: store.currentHour,
      minute: store.currentMinute,
    }

    // If there are no more sessions remaining today, never skip beyond the start of next day.
    const currentTotal = TimeController.toTotalMinutes(currentTime)
    const hasRemainingSessionsToday = sessions
      .filter((s) => s.status === 'scheduled' && s.scheduledDay === currentTime.day)
      .some((s) => {
        const sessionTime = TimeController.create(s.scheduledDay, s.scheduledHour, 0)
        return TimeController.toTotalMinutes(sessionTime) >= currentTotal
      })

    if (!hasRemainingSessionsToday) {
      const nextDayStart = TimeController.create(
        currentTime.day + 1,
        TIME_CONFIG.BUSINESS_START,
        0
      )

      if (TimeController.isAfter(targetTime, nextDayStart)) {
        targetTime = nextDayStart
      }
    }

    // Prevent skipping over the next scheduled session start.
    const nextSessionTime = this.getNextSessionTime()
    if (nextSessionTime && TimeController.isAfter(targetTime, nextSessionTime)) {
      return null
    }

    const result = TimeController.skipTo(currentTime, targetTime)

    if (result.minuteChanged) {
      this.applyTimeAdvance(result)

      // If we landed exactly at the top of an hour, start any sessions scheduled for that time.
      this.checkSessionStarts(result.newTime)
      return result
    }

    return null
  }

  /**
   * Find the next scheduled session time
   */
  getNextSessionTime(): GameTime | null {
    const { currentDay, currentHour, currentMinute, sessions } = useGameStore.getState()
    const currentTime: GameTime = {
      day: currentDay,
      hour: currentHour,
      minute: currentMinute,
    }

    const upcomingSessions = sessions
      .filter((s) => s.status === 'scheduled')
      .filter((s) => {
        const sessionTime = TimeController.create(s.scheduledDay, s.scheduledHour, 0)
        return TimeController.isAfter(sessionTime, currentTime)
      })
      .sort((a, b) => {
        const aTime = TimeController.create(a.scheduledDay, a.scheduledHour, 0)
        const bTime = TimeController.create(b.scheduledDay, b.scheduledHour, 0)
        return TimeController.toTotalMinutes(aTime) - TimeController.toTotalMinutes(bTime)
      })

    if (upcomingSessions.length === 0) {
      return null
    }

    const next = upcomingSessions[0]
    return TimeController.create(next.scheduledDay, next.scheduledHour, 0)
  }

  /**
   * Skip to the next scheduled session
   */
  skipToNextSession(): boolean {
    const { sessions, currentDay, currentHour, currentMinute } = useGameStore.getState()

    // Can't skip while any session is active.
    if (sessions.some((s) => s.status === 'in_progress')) {
      return false
    }

    // If a session is scheduled to start right now, do not skip time (but do start it).
    if (currentMinute === 0) {
      const hasSessionNow = sessions.some(
        (s) =>
          s.status === 'scheduled' &&
          s.scheduledDay === currentDay &&
          s.scheduledHour === currentHour
      )

      if (hasSessionNow) {
        this.checkSessionStarts({ day: currentDay, hour: currentHour, minute: currentMinute })
        return true
      }
    }

    // If there are no sessions remaining today, skip only to the start of the next day.
    const currentTime: GameTime = { day: currentDay, hour: currentHour, minute: currentMinute }
    const currentTotal = TimeController.toTotalMinutes(currentTime)
    const hasRemainingSessionsToday = sessions
      .filter((s) => s.status === 'scheduled' && s.scheduledDay === currentDay)
      .some((s) => {
        const sessionTime = TimeController.create(s.scheduledDay, s.scheduledHour, 0)
        return TimeController.toTotalMinutes(sessionTime) >= currentTotal
      })

    if (!hasRemainingSessionsToday) {
      const nextDayStart = TimeController.create(currentDay + 1, TIME_CONFIG.BUSINESS_START, 0)
      const result = this.skipTo(nextDayStart)
      return result !== null
    }

    const nextTime = this.getNextSessionTime()
    if (!nextTime) {
      return false
    }

    const result = this.skipTo(nextTime)
    return result !== null
  }
}

// Singleton instance for the game
let gameEngineInstance: GameEngine | null = null

/**
 * Get or create the game engine singleton
 */
export function getGameEngine(config?: Partial<GameEngineConfig>): GameEngine {
  if (!gameEngineInstance) {
    gameEngineInstance = new GameEngine(config)
  }
  return gameEngineInstance
}

/**
 * Reset the game engine singleton (useful for testing)
 */
export function resetGameEngine(): void {
  if (gameEngineInstance) {
    gameEngineInstance.stop()
    gameEngineInstance = null
  }
}
