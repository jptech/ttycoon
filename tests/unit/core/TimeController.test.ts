import { describe, it, expect } from 'vitest'
import { TimeController, TIME_CONFIG } from '@/core/engine'
import type { GameTime } from '@/core/types'

describe('TimeController', () => {
  describe('calculateMinutesToAdvance', () => {
    it('returns 0 minutes when game is paused (speed 0)', () => {
      const result = TimeController.calculateMinutesToAdvance(1000, 0, 0)
      expect(result.minutes).toBe(0)
      expect(result.remainingAccumulated).toBe(0)
    })

    it('calculates minutes correctly at 1x speed', () => {
      // 1 second at 1x = 2 game minutes (MINUTES_PER_REAL_SECOND = 2)
      const result = TimeController.calculateMinutesToAdvance(1000, 1, 0)
      expect(result.minutes).toBe(2)
      expect(result.remainingAccumulated).toBeCloseTo(0)
    })

    it('calculates minutes correctly at 2x speed', () => {
      // 1 second at 2x = 4 game minutes
      const result = TimeController.calculateMinutesToAdvance(1000, 2, 0)
      expect(result.minutes).toBe(4)
    })

    it('calculates minutes correctly at 3x speed', () => {
      // 1 second at 3x = 6 game minutes
      const result = TimeController.calculateMinutesToAdvance(1000, 3, 0)
      expect(result.minutes).toBe(6)
    })

    it('accumulates partial minutes', () => {
      // 0.3 seconds at 1x = 0.6 game minutes (not a full minute)
      const result1 = TimeController.calculateMinutesToAdvance(300, 1, 0)
      expect(result1.minutes).toBe(0)
      expect(result1.remainingAccumulated).toBeCloseTo(0.6)

      // Add another 0.3 seconds = 0.6 more, total 1.2
      const result2 = TimeController.calculateMinutesToAdvance(300, 1, result1.remainingAccumulated)
      expect(result2.minutes).toBe(1)
      expect(result2.remainingAccumulated).toBeCloseTo(0.2)
    })
  })

  describe('advanceMinutes', () => {
    it('advances minutes within the same hour', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 30 }
      const result = TimeController.advanceMinutes(currentTime, 15)

      expect(result.newTime).toEqual({ day: 1, hour: 9, minute: 45 })
      expect(result.minuteChanged).toBe(true)
      expect(result.hourChanged).toBe(false)
      expect(result.dayEnded).toBe(false)
      expect(result.dayStarted).toBe(false)
    })

    it('rolls over to the next hour', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 50 }
      const result = TimeController.advanceMinutes(currentTime, 15)

      expect(result.newTime).toEqual({ day: 1, hour: 10, minute: 5 })
      expect(result.minuteChanged).toBe(true)
      expect(result.hourChanged).toBe(true)
    })

    it('handles multiple hour rollovers', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 0 }
      const result = TimeController.advanceMinutes(currentTime, 180) // 3 hours

      expect(result.newTime).toEqual({ day: 1, hour: 12, minute: 0 })
      expect(result.hourChanged).toBe(true)
    })

    it('ends day at business end (5 PM) and starts next day at 8 AM', () => {
      const currentTime: GameTime = { day: 1, hour: 16, minute: 50 }
      const result = TimeController.advanceMinutes(currentTime, 15)

      // Should roll to next day at 8 AM
      expect(result.newTime.day).toBe(2)
      expect(result.newTime.hour).toBe(TIME_CONFIG.BUSINESS_START)
      expect(result.newTime.minute).toBe(0)
      expect(result.dayEnded).toBe(true)
      expect(result.dayStarted).toBe(true)
    })

    it('returns unchanged time when advancing 0 minutes', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 30 }
      const result = TimeController.advanceMinutes(currentTime, 0)

      expect(result.newTime).toEqual(currentTime)
      expect(result.minuteChanged).toBe(false)
    })
  })

  describe('skipTo', () => {
    it('skips to a future time on the same day', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 0 }
      const targetTime: GameTime = { day: 1, hour: 14, minute: 30 }

      const result = TimeController.skipTo(currentTime, targetTime)

      expect(result.newTime).toEqual(targetTime)
      expect(result.minuteChanged).toBe(true)
      expect(result.hourChanged).toBe(true)
      expect(result.dayEnded).toBe(false)
    })

    it('skips to a future day', () => {
      const currentTime: GameTime = { day: 1, hour: 9, minute: 0 }
      const targetTime: GameTime = { day: 3, hour: 10, minute: 0 }

      const result = TimeController.skipTo(currentTime, targetTime)

      expect(result.newTime).toEqual(targetTime)
      expect(result.dayEnded).toBe(true)
      expect(result.dayStarted).toBe(true)
    })

    it('does not skip to a past time', () => {
      const currentTime: GameTime = { day: 2, hour: 14, minute: 0 }
      const targetTime: GameTime = { day: 1, hour: 10, minute: 0 }

      const result = TimeController.skipTo(currentTime, targetTime)

      expect(result.newTime).toEqual(currentTime)
      expect(result.minuteChanged).toBe(false)
    })
  })

  describe('isAfter', () => {
    it('returns true when day is greater', () => {
      const a: GameTime = { day: 2, hour: 8, minute: 0 }
      const b: GameTime = { day: 1, hour: 17, minute: 59 }

      expect(TimeController.isAfter(a, b)).toBe(true)
    })

    it('returns true when hour is greater on same day', () => {
      const a: GameTime = { day: 1, hour: 10, minute: 0 }
      const b: GameTime = { day: 1, hour: 9, minute: 59 }

      expect(TimeController.isAfter(a, b)).toBe(true)
    })

    it('returns true when minute is greater on same hour', () => {
      const a: GameTime = { day: 1, hour: 9, minute: 30 }
      const b: GameTime = { day: 1, hour: 9, minute: 15 }

      expect(TimeController.isAfter(a, b)).toBe(true)
    })

    it('returns false for equal times', () => {
      const a: GameTime = { day: 1, hour: 9, minute: 30 }
      const b: GameTime = { day: 1, hour: 9, minute: 30 }

      expect(TimeController.isAfter(a, b)).toBe(false)
    })

    it('returns false when time is before', () => {
      const a: GameTime = { day: 1, hour: 9, minute: 0 }
      const b: GameTime = { day: 1, hour: 10, minute: 0 }

      expect(TimeController.isAfter(a, b)).toBe(false)
    })
  })

  describe('isEqual', () => {
    it('returns true for equal times', () => {
      const a: GameTime = { day: 5, hour: 12, minute: 30 }
      const b: GameTime = { day: 5, hour: 12, minute: 30 }

      expect(TimeController.isEqual(a, b)).toBe(true)
    })

    it('returns false for different times', () => {
      const a: GameTime = { day: 5, hour: 12, minute: 30 }
      const b: GameTime = { day: 5, hour: 12, minute: 31 }

      expect(TimeController.isEqual(a, b)).toBe(false)
    })
  })

  describe('isBusinessHours', () => {
    it('returns true for times within business hours', () => {
      expect(TimeController.isBusinessHours({ day: 1, hour: 8, minute: 0 })).toBe(true)
      expect(TimeController.isBusinessHours({ day: 1, hour: 12, minute: 30 })).toBe(true)
      expect(TimeController.isBusinessHours({ day: 1, hour: 16, minute: 59 })).toBe(true)
    })

    it('returns false for times outside business hours', () => {
      expect(TimeController.isBusinessHours({ day: 1, hour: 7, minute: 59 })).toBe(false)
      expect(TimeController.isBusinessHours({ day: 1, hour: 17, minute: 0 })).toBe(false)
      expect(TimeController.isBusinessHours({ day: 1, hour: 20, minute: 0 })).toBe(false)
    })
  })

  describe('minutesUntilDayEnd', () => {
    it('calculates minutes correctly from start of day', () => {
      const time: GameTime = { day: 1, hour: 8, minute: 0 }
      // 5 PM = 17:00, 8 AM = 8:00, difference = 9 hours = 540 minutes
      expect(TimeController.minutesUntilDayEnd(time)).toBe(540)
    })

    it('calculates minutes correctly from mid-day', () => {
      const time: GameTime = { day: 1, hour: 12, minute: 30 }
      // 5 PM = 17:00, 12:30 PM, difference = 4.5 hours = 270 minutes
      expect(TimeController.minutesUntilDayEnd(time)).toBe(270)
    })

    it('returns 0 when at or past end of business day', () => {
      expect(TimeController.minutesUntilDayEnd({ day: 1, hour: 17, minute: 0 })).toBe(0)
      expect(TimeController.minutesUntilDayEnd({ day: 1, hour: 18, minute: 0 })).toBe(0)
    })
  })

  describe('toTotalMinutes', () => {
    it('converts time to total minutes', () => {
      const time: GameTime = { day: 1, hour: 9, minute: 30 }
      // Day 1 = 1440 minutes, 9 hours = 540, 30 minutes
      expect(TimeController.toTotalMinutes(time)).toBe(1440 + 540 + 30)
    })
  })

  describe('diffMinutes', () => {
    it('calculates difference between times', () => {
      const from: GameTime = { day: 1, hour: 9, minute: 0 }
      const to: GameTime = { day: 1, hour: 10, minute: 30 }

      expect(TimeController.diffMinutes(from, to)).toBe(90)
    })

    it('returns negative for past times', () => {
      const from: GameTime = { day: 1, hour: 10, minute: 0 }
      const to: GameTime = { day: 1, hour: 9, minute: 0 }

      expect(TimeController.diffMinutes(from, to)).toBe(-60)
    })
  })

  describe('create', () => {
    it('creates a GameTime object', () => {
      expect(TimeController.create(5, 14, 30)).toEqual({ day: 5, hour: 14, minute: 30 })
    })

    it('defaults minute to 0', () => {
      expect(TimeController.create(1, 9)).toEqual({ day: 1, hour: 9, minute: 0 })
    })
  })

  describe('format', () => {
    it('formats morning times correctly', () => {
      expect(TimeController.format({ day: 1, hour: 9, minute: 30 })).toBe('Day 1, 9:30 AM')
    })

    it('formats afternoon times correctly', () => {
      expect(TimeController.format({ day: 5, hour: 14, minute: 15 })).toBe('Day 5, 2:15 PM')
    })

    it('formats noon correctly', () => {
      expect(TimeController.format({ day: 1, hour: 12, minute: 0 })).toBe('Day 1, 12:00 PM')
    })

    it('pads minutes with leading zero', () => {
      expect(TimeController.format({ day: 1, hour: 9, minute: 5 })).toBe('Day 1, 9:05 AM')
    })
  })
})
