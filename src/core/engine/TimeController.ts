import type { GameTime } from '@/core/types'

/**
 * Business hours configuration
 */
export const TIME_CONFIG = {
  BUSINESS_START: 8, // 8 AM
  BUSINESS_END: 17, // 5 PM
  MINUTES_PER_REAL_SECOND: 2, // At 1x speed, 2 game minutes pass per real second
  SESSION_DURATION_STANDARD: 50,
  SESSION_DURATION_EXTENDED: 80,
  SESSION_DURATION_INTENSIVE: 180,
} as const

/**
 * Result of advancing time
 */
export interface TimeAdvanceResult {
  minuteChanged: boolean
  hourChanged: boolean
  dayEnded: boolean
  dayStarted: boolean
  previousTime: GameTime
  newTime: GameTime
}

/**
 * TimeController manages game time simulation.
 * Pure functions for time calculations - no side effects.
 */
export const TimeController = {
  /**
   * Calculate how many game minutes to advance based on real time delta and speed
   */
  calculateMinutesToAdvance(
    deltaTimeMs: number,
    gameSpeed: number,
    accumulatedTime: number
  ): { minutes: number; remainingAccumulated: number } {
    if (gameSpeed === 0) {
      return { minutes: 0, remainingAccumulated: accumulatedTime }
    }

    const deltaSeconds = deltaTimeMs / 1000
    const gameMinutesToAdd = deltaSeconds * TIME_CONFIG.MINUTES_PER_REAL_SECOND * gameSpeed
    const totalAccumulated = accumulatedTime + gameMinutesToAdd

    const wholeMinutes = Math.floor(totalAccumulated)
    const remainingAccumulated = totalAccumulated - wholeMinutes

    return { minutes: wholeMinutes, remainingAccumulated }
  },

  /**
   * Advance time by a given number of minutes
   */
  advanceMinutes(currentTime: GameTime, minutes: number): TimeAdvanceResult {
    const result: TimeAdvanceResult = {
      minuteChanged: false,
      hourChanged: false,
      dayEnded: false,
      dayStarted: false,
      previousTime: { ...currentTime },
      newTime: { ...currentTime },
    }

    if (minutes <= 0) {
      return result
    }

    let { day, hour, minute } = currentTime
    minute += minutes
    result.minuteChanged = true

    // Handle minute overflow -> hours
    while (minute >= 60) {
      minute -= 60
      hour += 1
      result.hourChanged = true

      // Handle end of business day
      if (hour >= TIME_CONFIG.BUSINESS_END) {
        result.dayEnded = true
        day += 1
        hour = TIME_CONFIG.BUSINESS_START
        minute = 0
        result.dayStarted = true
      }
    }

    result.newTime = { day, hour, minute }
    return result
  },

  /**
   * Advance to a specific time (for "skip to next session")
   */
  skipTo(currentTime: GameTime, targetTime: GameTime): TimeAdvanceResult {
    const result: TimeAdvanceResult = {
      minuteChanged: false,
      hourChanged: false,
      dayEnded: false,
      dayStarted: false,
      previousTime: { ...currentTime },
      newTime: { ...currentTime },
    }

    // Validate target is in the future
    if (!this.isAfter(targetTime, currentTime)) {
      return result
    }

    result.minuteChanged = true
    result.hourChanged = currentTime.hour !== targetTime.hour || currentTime.day !== targetTime.day
    result.dayEnded = currentTime.day !== targetTime.day
    result.dayStarted = currentTime.day !== targetTime.day
    result.newTime = { ...targetTime }

    return result
  },

  /**
   * Check if time A is after time B
   */
  isAfter(a: GameTime, b: GameTime): boolean {
    if (a.day !== b.day) return a.day > b.day
    if (a.hour !== b.hour) return a.hour > b.hour
    return a.minute > b.minute
  },

  /**
   * Check if time A equals time B
   */
  isEqual(a: GameTime, b: GameTime): boolean {
    return a.day === b.day && a.hour === b.hour && a.minute === b.minute
  },

  /**
   * Check if a time is within business hours
   */
  isBusinessHours(time: GameTime): boolean {
    return time.hour >= TIME_CONFIG.BUSINESS_START && time.hour < TIME_CONFIG.BUSINESS_END
  },

  /**
   * Get minutes until end of business day
   */
  minutesUntilDayEnd(time: GameTime): number {
    const endMinute = TIME_CONFIG.BUSINESS_END * 60
    const currentMinute = time.hour * 60 + time.minute
    return Math.max(0, endMinute - currentMinute)
  },

  /**
   * Convert GameTime to total minutes (for comparison)
   */
  toTotalMinutes(time: GameTime): number {
    const minutesPerDay = 24 * 60
    return time.day * minutesPerDay + time.hour * 60 + time.minute
  },

  /**
   * Get the difference in minutes between two times
   */
  diffMinutes(from: GameTime, to: GameTime): number {
    return this.toTotalMinutes(to) - this.toTotalMinutes(from)
  },

  /**
   * Create a GameTime from day, hour, and minute
   */
  create(day: number, hour: number, minute: number = 0): GameTime {
    return { day, hour, minute }
  },

  /**
   * Format time for display (e.g., "Day 5, 2:30 PM")
   */
  format(time: GameTime): string {
    const period = time.hour >= 12 ? 'PM' : 'AM'
    const displayHour = time.hour === 0 ? 12 : time.hour > 12 ? time.hour - 12 : time.hour
    const displayMinute = time.minute.toString().padStart(2, '0')
    return `Day ${time.day}, ${displayHour}:${displayMinute} ${period}`
  },
}
