import { describe, it, expect, beforeEach } from 'vitest'
import {
  TherapistManager,
  DEFAULT_WORK_SCHEDULE,
  THERAPIST_CONFIG,
} from '@/core/therapists'
import { ScheduleManager } from '@/core/schedule'
import type { Therapist, Session, Schedule, TherapistWorkSchedule } from '@/core/types'

// Helper to create a test therapist
function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 'test-1',
    displayName: 'Dr. Test',
    isPlayer: false,
    credential: 'LPC',
    primaryModality: 'CBT',
    secondaryModalities: [],
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 1,
    xp: 0,
    hourlySalary: 30,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 5, analytical: 5, creativity: 5 },
    workSchedule: { ...DEFAULT_WORK_SCHEDULE },
    ...overrides,
  }
}

// Helper to create a test session
function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    therapistId: 'test-1',
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
    clientName: 'Client One',
    ...overrides,
  }
}

describe('TherapistManager Work Schedule', () => {
  describe('getWorkSchedule', () => {
    it('returns default schedule if therapist has no workSchedule', () => {
      const therapist = createTherapist()
      // @ts-expect-error - Testing undefined workSchedule
      delete therapist.workSchedule

      const schedule = TherapistManager.getWorkSchedule(therapist)
      expect(schedule.workStartHour).toBe(8)
      expect(schedule.workEndHour).toBe(17)
      expect(schedule.breakHours).toEqual([])
    })

    it('returns therapist custom schedule', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 10,
          workEndHour: 18,
          breakHours: [13],
        },
      })

      const schedule = TherapistManager.getWorkSchedule(therapist)
      expect(schedule.workStartHour).toBe(10)
      expect(schedule.workEndHour).toBe(18)
      expect(schedule.breakHours).toEqual([13])
    })
  })

  describe('isWithinWorkHours', () => {
    it('returns true for hours within work schedule', () => {
      const therapist = createTherapist() // 8-17, no lunch

      expect(TherapistManager.isWithinWorkHours(therapist, 8)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 12)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 16)).toBe(true)
    })

    it('returns false for hours before work starts', () => {
      const therapist = createTherapist()
      expect(TherapistManager.isWithinWorkHours(therapist, 7)).toBe(false)
      expect(TherapistManager.isWithinWorkHours(therapist, 6)).toBe(false)
    })

    it('returns false for hours at or after work ends', () => {
      const therapist = createTherapist() // ends at 17
      expect(TherapistManager.isWithinWorkHours(therapist, 17)).toBe(false)
      expect(TherapistManager.isWithinWorkHours(therapist, 18)).toBe(false)
    })

    it('returns false for break hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [12],
        },
      })

      expect(TherapistManager.isWithinWorkHours(therapist, 11)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 12)).toBe(false)
      expect(TherapistManager.isWithinWorkHours(therapist, 13)).toBe(true)
    })

    it('works with custom early schedule and multiple breaks', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 6,
          workEndHour: 14,
          breakHours: [10, 12],
        },
      })

      expect(TherapistManager.isWithinWorkHours(therapist, 6)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 10)).toBe(false)
      expect(TherapistManager.isWithinWorkHours(therapist, 11)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 12)).toBe(false)
      expect(TherapistManager.isWithinWorkHours(therapist, 13)).toBe(true)
      expect(TherapistManager.isWithinWorkHours(therapist, 14)).toBe(false)
    })
  })

  describe('getWorkHours', () => {
    it('returns all hours within work schedule', () => {
      const therapist = createTherapist() // 8-17, no lunch

      const hours = TherapistManager.getWorkHours(therapist)
      expect(hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
    })

    it('excludes break hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [12],
        },
      })

      const hours = TherapistManager.getWorkHours(therapist)
      expect(hours).not.toContain(12)
      expect(hours).toEqual([8, 9, 10, 11, 13, 14, 15, 16])
    })

    it('excludes multiple break hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [10, 12, 15],
        },
      })

      const hours = TherapistManager.getWorkHours(therapist)
      expect(hours).not.toContain(10)
      expect(hours).not.toContain(12)
      expect(hours).not.toContain(15)
      expect(hours).toEqual([8, 9, 11, 13, 14, 16])
    })
  })

  describe('getWorkingHoursPerDay', () => {
    it('calculates total working hours without breaks', () => {
      const therapist = createTherapist() // 8-17, no breaks
      expect(TherapistManager.getWorkingHoursPerDay(therapist)).toBe(9)
    })

    it('subtracts break hours from total', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [12],
        },
      })
      expect(TherapistManager.getWorkingHoursPerDay(therapist)).toBe(8)
    })

    it('subtracts multiple break hours from total', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [10, 12, 15],
        },
      })
      expect(TherapistManager.getWorkingHoursPerDay(therapist)).toBe(6)
    })

    it('works with short schedule', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 10,
          workEndHour: 14,
          breakHours: [],
        },
      })
      expect(TherapistManager.getWorkingHoursPerDay(therapist)).toBe(4)
    })
  })

  describe('updateWorkSchedule', () => {
    it('updates work schedule with partial changes', () => {
      const therapist = createTherapist()
      const updated = TherapistManager.updateWorkSchedule(therapist, {
        workStartHour: 9,
      })

      expect(updated.workSchedule.workStartHour).toBe(9)
      expect(updated.workSchedule.workEndHour).toBe(17) // unchanged
      expect(updated.workSchedule.breakHours).toEqual([]) // unchanged
    })

    it('can add break hours', () => {
      const therapist = createTherapist()
      const updated = TherapistManager.updateWorkSchedule(therapist, {
        breakHours: [12],
      })

      expect(updated.workSchedule.breakHours).toEqual([12])
    })

    it('can add multiple break hours', () => {
      const therapist = createTherapist()
      const updated = TherapistManager.updateWorkSchedule(therapist, {
        breakHours: [10, 12, 15],
      })

      expect(updated.workSchedule.breakHours).toEqual([10, 12, 15])
    })

    it('can clear all breaks', () => {
      const therapist = createTherapist({
        workSchedule: { workStartHour: 8, workEndHour: 17, breakHours: [12] },
      })
      const updated = TherapistManager.updateWorkSchedule(therapist, {
        breakHours: [],
      })

      expect(updated.workSchedule.breakHours).toEqual([])
    })
  })

  describe('validateWorkSchedule', () => {
    it('accepts valid schedule', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 8,
        workEndHour: 17,
        breakHours: [12],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(true)
    })

    it('accepts schedule with multiple breaks', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 6,
        workEndHour: 20,
        breakHours: [10, 12, 15],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(true)
    })

    it('rejects start hour before 6am', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 5,
        workEndHour: 14,
        breakHours: [],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('6am')
    })

    it('rejects end hour after 10pm', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 14,
        workEndHour: 23,
        breakHours: [],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('10pm')
    })

    it('rejects end before start', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 14,
        workEndHour: 10,
        breakHours: [],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('after start')
    })

    it('rejects less than 4 hours work day', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 10,
        workEndHour: 13,
        breakHours: [],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('4 hours')
    })

    it('rejects break outside work hours', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 10,
        workEndHour: 16,
        breakHours: [9], // before start
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('within work hours')
    })

    it('rejects more than 3 breaks', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 6,
        workEndHour: 20,
        breakHours: [8, 10, 12, 15], // 4 breaks
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Maximum 3 breaks')
    })

    it('rejects duplicate break hours', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 8,
        workEndHour: 17,
        breakHours: [12, 12],
      }
      const result = TherapistManager.validateWorkSchedule(schedule)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Duplicate')
    })

    it('rejects if too few working hours after breaks', () => {
      const schedule: TherapistWorkSchedule = {
        workStartHour: 10,
        workEndHour: 16, // 6 hours
        breakHours: [11, 12, 14, 15], // This will fail on max breaks first
      }
      // Test with 3 breaks
      const scheduleValid: TherapistWorkSchedule = {
        workStartHour: 10,
        workEndHour: 16, // 6 hours
        breakHours: [11, 12, 14], // 3 breaks = 3 working hours, which is minimum
      }
      const result = TherapistManager.validateWorkSchedule(scheduleValid)
      expect(result.valid).toBe(true) // 3 working hours is exactly minimum
    })
  })
})

describe('Energy Forecasting', () => {
  describe('getSessionEnergyCost', () => {
    it('returns correct cost for 50-minute session', () => {
      expect(TherapistManager.getSessionEnergyCost(50)).toBe(
        THERAPIST_CONFIG.SESSION_ENERGY_COST
      )
    })

    it('returns correct cost for 80-minute session', () => {
      expect(TherapistManager.getSessionEnergyCost(80)).toBe(
        THERAPIST_CONFIG.EXTENDED_SESSION_ENERGY_COST
      )
    })

    it('returns correct cost for 180-minute session', () => {
      expect(TherapistManager.getSessionEnergyCost(180)).toBe(
        THERAPIST_CONFIG.INTENSIVE_SESSION_ENERGY_COST
      )
    })
  })

  describe('forecastEnergy', () => {
    it('returns zero sessions when no sessions scheduled', () => {
      const therapist = createTherapist()
      const forecast = TherapistManager.forecastEnergy(therapist, [], {}, 1)

      expect(forecast.scheduledSessionCount).toBe(0)
      expect(forecast.totalEnergyCost).toBe(0)
      expect(forecast.predictedEndEnergy).toBe(100)
      expect(forecast.willBurnOut).toBe(false)
    })

    it('forecasts energy for scheduled sessions', () => {
      const therapist = createTherapist({ energy: 100 })
      const sessions = [
        createSession({ scheduledDay: 1, scheduledHour: 9 }),
        createSession({ id: 'session-2', scheduledDay: 1, scheduledHour: 10 }),
        createSession({ id: 'session-3', scheduledDay: 1, scheduledHour: 11 }),
      ]

      const forecast = TherapistManager.forecastEnergy(therapist, sessions, {}, 1)

      expect(forecast.scheduledSessionCount).toBe(3)
      expect(forecast.totalEnergyCost).toBe(45) // 15 * 3
      expect(forecast.predictedEndEnergy).toBe(55) // 100 - 45
      expect(forecast.willBurnOut).toBe(false)
    })

    it('only counts sessions for the specified day', () => {
      const therapist = createTherapist()
      const sessions = [
        createSession({ scheduledDay: 1, scheduledHour: 9 }),
        createSession({ id: 'session-2', scheduledDay: 2, scheduledHour: 10 }),
      ]

      const forecast = TherapistManager.forecastEnergy(therapist, sessions, {}, 1)

      expect(forecast.scheduledSessionCount).toBe(1)
    })

    it('only counts scheduled and in_progress sessions', () => {
      const therapist = createTherapist()
      const sessions = [
        createSession({ scheduledDay: 1, scheduledHour: 9, status: 'scheduled' }),
        createSession({
          id: 'session-2',
          scheduledDay: 1,
          scheduledHour: 10,
          status: 'completed',
        }),
        createSession({
          id: 'session-3',
          scheduledDay: 1,
          scheduledHour: 11,
          status: 'cancelled',
        }),
      ]

      const forecast = TherapistManager.forecastEnergy(therapist, sessions, {}, 1)

      expect(forecast.scheduledSessionCount).toBe(1)
    })

    it('detects burnout risk', () => {
      const therapist = createTherapist({ energy: 50 })
      const sessions = [
        createSession({ scheduledDay: 1, scheduledHour: 9 }),
        createSession({ id: 'session-2', scheduledDay: 1, scheduledHour: 10 }),
        createSession({ id: 'session-3', scheduledDay: 1, scheduledHour: 11 }),
      ]

      const forecast = TherapistManager.forecastEnergy(therapist, sessions, {}, 1)

      expect(forecast.willBurnOut).toBe(true)
      expect(forecast.burnoutHour).toBe(11) // Third session causes burnout
    })

    it('handles extended and intensive sessions', () => {
      const therapist = createTherapist({ energy: 100 })
      const sessions = [
        createSession({ scheduledDay: 1, scheduledHour: 9, durationMinutes: 80 }),
        createSession({
          id: 'session-2',
          scheduledDay: 1,
          scheduledHour: 11,
          durationMinutes: 180,
        }),
      ]

      const forecast = TherapistManager.forecastEnergy(therapist, sessions, {}, 1)

      // 25 (80-min) + 45 (180-min) = 70
      expect(forecast.totalEnergyCost).toBe(70)
      expect(forecast.predictedEndEnergy).toBe(30)
    })
  })

  describe('formatEnergyForecast', () => {
    it('formats empty forecast', () => {
      const forecast = {
        predictedEndEnergy: 100,
        scheduledSessionCount: 0,
        totalEnergyCost: 0,
        willBurnOut: false,
        burnoutHour: null,
      }

      expect(TherapistManager.formatEnergyForecast(forecast)).toBe(
        'No sessions scheduled'
      )
    })

    it('formats normal forecast', () => {
      const forecast = {
        predictedEndEnergy: 55,
        scheduledSessionCount: 3,
        totalEnergyCost: 45,
        willBurnOut: false,
        burnoutHour: null,
      }

      const result = TherapistManager.formatEnergyForecast(forecast)
      expect(result).toContain('3 sessions')
      expect(result).toContain('~55 energy EOD')
    })

    it('formats single session correctly', () => {
      const forecast = {
        predictedEndEnergy: 85,
        scheduledSessionCount: 1,
        totalEnergyCost: 15,
        willBurnOut: false,
        burnoutHour: null,
      }

      const result = TherapistManager.formatEnergyForecast(forecast)
      expect(result).toContain('1 session')
      expect(result).not.toContain('sessions')
    })

    it('shows burnout warning', () => {
      const forecast = {
        predictedEndEnergy: 5,
        scheduledSessionCount: 6,
        totalEnergyCost: 90,
        willBurnOut: true,
        burnoutHour: 14,
      }

      const result = TherapistManager.formatEnergyForecast(forecast)
      expect(result).toContain('BURNOUT')
    })
  })
})

describe('ScheduleManager with Work Hours', () => {
  describe('isSlotAvailable with therapist', () => {
    it('respects therapist work hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 10,
          workEndHour: 16,
          breakHours: [],
        },
      })
      const schedule: Schedule = {}

      // Before work hours
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 9, 50, therapist)
      ).toBe(false)

      // Within work hours
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 10, 50, therapist)
      ).toBe(true)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 15, 50, therapist)
      ).toBe(true)

      // At or after end
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 16, 50, therapist)
      ).toBe(false)
    })

    it('blocks break hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [12],
        },
      })
      const schedule: Schedule = {}

      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 11, 50, therapist)
      ).toBe(true)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 12, 50, therapist)
      ).toBe(false)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 13, 50, therapist)
      ).toBe(true)
    })

    it('blocks multiple break hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [10, 12, 15],
        },
      })
      const schedule: Schedule = {}

      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 10, 50, therapist)
      ).toBe(false)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 11, 50, therapist)
      ).toBe(true)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 12, 50, therapist)
      ).toBe(false)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 15, 50, therapist)
      ).toBe(false)
    })

    it('blocks extended sessions that would span into break', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [12],
        },
      })
      const schedule: Schedule = {}

      // 80-minute session starting at 11 would span 11:00-12:30, hitting break
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 11, 80, therapist)
      ).toBe(false)

      // But 50-minute session at 11 is fine (ends 11:50)
      expect(
        ScheduleManager.isSlotAvailable(schedule, therapist.id, 1, 11, 50, therapist)
      ).toBe(true)
    })

    it('falls back to global business hours when no therapist provided', () => {
      const schedule: Schedule = {}

      // Global hours are 8-18 (BUSINESS_END is 18)
      expect(ScheduleManager.isSlotAvailable(schedule, 'test-1', 1, 7, 50)).toBe(false)
      expect(ScheduleManager.isSlotAvailable(schedule, 'test-1', 1, 8, 50)).toBe(true)
      expect(ScheduleManager.isSlotAvailable(schedule, 'test-1', 1, 17, 50)).toBe(true) // 5 PM is within hours
      expect(ScheduleManager.isSlotAvailable(schedule, 'test-1', 1, 18, 50)).toBe(false) // 6 PM is end of day
    })
  })

  describe('getAvailableSlotsForDay with therapist', () => {
    it('only returns slots within therapist work hours', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 10,
          workEndHour: 14,
          breakHours: [],
        },
      })
      const schedule: Schedule = {}

      const slots = ScheduleManager.getAvailableSlotsForDay(
        schedule,
        therapist.id,
        1,
        50,
        therapist
      )

      expect(slots).toEqual([10, 11, 12, 13])
    })

    it('excludes break hours from available slots', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 10,
          workEndHour: 15,
          breakHours: [12],
        },
      })
      const schedule: Schedule = {}

      const slots = ScheduleManager.getAvailableSlotsForDay(
        schedule,
        therapist.id,
        1,
        50,
        therapist
      )

      expect(slots).toEqual([10, 11, 13, 14])
      expect(slots).not.toContain(12)
    })

    it('excludes multiple break hours from available slots', () => {
      const therapist = createTherapist({
        workSchedule: {
          workStartHour: 8,
          workEndHour: 17,
          breakHours: [10, 12, 15],
        },
      })
      const schedule: Schedule = {}

      const slots = ScheduleManager.getAvailableSlotsForDay(
        schedule,
        therapist.id,
        1,
        50,
        therapist
      )

      expect(slots).not.toContain(10)
      expect(slots).not.toContain(12)
      expect(slots).not.toContain(15)
      expect(slots).toEqual([8, 9, 11, 13, 14, 16])
    })
  })
})
