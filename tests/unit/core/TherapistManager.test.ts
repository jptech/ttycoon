import { describe, it, expect } from 'vitest'
import { TherapistManager, THERAPIST_CONFIG } from '@/core/therapists'
import { TRAINING_PROGRAMS } from '@/data/trainingPrograms'
import type { Therapist, ActiveTraining } from '@/core/types'

// Helper to create a test therapist
function createTestTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 'therapist-1',
    displayName: 'Dr. Test',
    isPlayer: false,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 5,
    xp: 0,
    hourlySalary: 35,
    hireDay: 1,
    certifications: [],
    specializations: ['stress_management'],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: {
      warmth: 7,
      analytical: 5,
      creativity: 5,
    },
    ...overrides,
  }
}

describe('TherapistManager', () => {
  describe('createPlayerTherapist', () => {
    it('creates a player therapist with correct defaults', () => {
      const player = TherapistManager.createPlayerTherapist('Dr. Player')

      expect(player.id).toBe('player')
      expect(player.displayName).toBe('Dr. Player')
      expect(player.isPlayer).toBe(true)
      expect(player.energy).toBe(THERAPIST_CONFIG.BASE_MAX_ENERGY)
      expect(player.hourlySalary).toBe(0)
      expect(player.status).toBe('available')
    })

    it('player starts at level 1 with base skill', () => {
      const player = TherapistManager.createPlayerTherapist('Dr. Player')

      expect(player.level).toBe(1)
      expect(player.baseSkill).toBe(40)
      expect(player.xp).toBe(0)
    })
  })

  describe('generateTherapist', () => {
    it('generates a therapist with valid properties', () => {
      const result = TherapistManager.generateTherapist(1, 1)

      expect(result.therapist.id).toBeDefined()
      // Name may or may not have "Dr." prefix depending on credential
      expect(result.therapist.displayName).toMatch(/^(Dr\. )?\w+ \w+$/)
      expect(result.therapist.isPlayer).toBe(false)
      // Should have credential and modality
      expect(result.therapist.credential).toBeDefined()
      expect(result.therapist.primaryModality).toBeDefined()
      expect(result.therapist.energy).toBe(THERAPIST_CONFIG.BASE_MAX_ENERGY)
      expect(result.therapist.status).toBe('available')
      expect(result.therapist.hourlySalary).toBeGreaterThanOrEqual(THERAPIST_CONFIG.MIN_HOURLY_SALARY)
      expect(result.therapist.hourlySalary).toBeLessThanOrEqual(THERAPIST_CONFIG.MAX_HOURLY_SALARY)
      expect(result.hiringCost).toBeGreaterThan(0)
      expect(result.monthlySalary).toBeGreaterThan(0)
    })

    it('generates deterministic results with seed', () => {
      const result1 = TherapistManager.generateTherapist(1, 1, 12345)
      const result2 = TherapistManager.generateTherapist(1, 1, 12345)

      expect(result1.therapist.displayName).toBe(result2.therapist.displayName)
      expect(result1.therapist.baseSkill).toBe(result2.therapist.baseSkill)
      expect(result1.therapist.hourlySalary).toBe(result2.therapist.hourlySalary)
      expect(result1.hiringCost).toBe(result2.hiringCost)
    })

    it('generates better candidates at higher practice levels', () => {
      const lowLevel = TherapistManager.generateTherapist(1, 1, 100)
      const highLevel = TherapistManager.generateTherapist(1, 5, 100)

      // Higher practice level should have higher minimum skill
      expect(highLevel.therapist.baseSkill).toBeGreaterThanOrEqual(lowLevel.therapist.baseSkill)
      // Pay should roughly correlate with skill/experience (with some noise)
      expect(highLevel.therapist.hourlySalary).toBeGreaterThanOrEqual(lowLevel.therapist.hourlySalary)
    })

    it('calculates appropriate hiring cost', () => {
      const result = TherapistManager.generateTherapist(1, 3, 42)

      // Hiring cost should be based on skill and certifications
      const expectedBaseCost = result.therapist.baseSkill * THERAPIST_CONFIG.HIRING_COST_MULTIPLIER
      expect(result.hiringCost).toBeGreaterThanOrEqual(expectedBaseCost)
    })
  })

  describe('processSessionWork', () => {
    it('reduces energy after session', () => {
      const therapist = createTestTherapist({ energy: 100 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.8)

      expect(result.updatedTherapist.energy).toBe(100 - THERAPIST_CONFIG.SESSION_ENERGY_COST)
      expect(result.energySpent).toBe(THERAPIST_CONFIG.SESSION_ENERGY_COST)
    })

    it('uses more energy for extended sessions', () => {
      const therapist = createTestTherapist({ energy: 100 })
      const result = TherapistManager.processSessionWork(therapist, 80, 0.8)

      expect(result.energySpent).toBe(THERAPIST_CONFIG.EXTENDED_SESSION_ENERGY_COST)
    })

    it('uses more energy for intensive sessions', () => {
      const therapist = createTestTherapist({ energy: 100 })
      const result = TherapistManager.processSessionWork(therapist, 180, 0.8)

      expect(result.energySpent).toBe(THERAPIST_CONFIG.INTENSIVE_SESSION_ENERGY_COST)
    })

    it('grants XP after session', () => {
      const therapist = createTestTherapist({ xp: 0 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.8)

      expect(result.xpGained).toBeGreaterThan(0)
      expect(result.updatedTherapist.xp).toBeGreaterThan(0)
    })

    it('grants bonus XP for high quality sessions', () => {
      const therapist = createTestTherapist({ xp: 0 })
      const lowQuality = TherapistManager.processSessionWork(therapist, 50, 0.5)
      const highQuality = TherapistManager.processSessionWork(therapist, 50, 0.9)

      expect(highQuality.xpGained).toBeGreaterThan(lowQuality.xpGained)
    })

    it('triggers level up when XP threshold reached', () => {
      const xpNeeded = TherapistManager.getXpForLevel(2)
      const therapist = createTestTherapist({ level: 1, xp: xpNeeded - 10 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.9)

      // With quality bonus, should have enough XP
      expect(result.leveledUp).toBe(true)
      expect(result.updatedTherapist.level).toBe(2)
    })

    it('increases skill on level up', () => {
      const xpNeeded = TherapistManager.getXpForLevel(2)
      const therapist = createTestTherapist({ level: 1, xp: xpNeeded - 10, baseSkill: 40 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.9)

      if (result.leveledUp) {
        expect(result.updatedTherapist.baseSkill).toBe(40 + THERAPIST_CONFIG.SKILL_PER_LEVEL)
      }
    })

    it('triggers burnout when energy drops too low', () => {
      const therapist = createTestTherapist({ energy: 15 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.8)

      expect(result.burnedOut).toBe(true)
      expect(result.updatedTherapist.status).toBe('burned_out')
    })

    it('does not go below 0 energy', () => {
      const therapist = createTestTherapist({ energy: 5 })
      const result = TherapistManager.processSessionWork(therapist, 50, 0.8)

      expect(result.updatedTherapist.energy).toBe(0)
    })
  })

  describe('processRest', () => {
    it('recovers energy based on hours', () => {
      const therapist = createTestTherapist({ energy: 50 })
      const result = TherapistManager.processRest(therapist, 2)

      const expectedRecovery = 2 * THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR
      expect(result.energyRecovered).toBe(expectedRecovery)
      expect(result.updatedTherapist.energy).toBe(50 + expectedRecovery)
    })

    it('does not exceed max energy', () => {
      const therapist = createTestTherapist({ energy: 95, maxEnergy: 100 })
      const result = TherapistManager.processRest(therapist, 2)

      expect(result.updatedTherapist.energy).toBe(100)
      expect(result.energyRecovered).toBe(5)
    })

    it('progresses burnout recovery', () => {
      const therapist = createTestTherapist({
        status: 'burned_out',
        burnoutRecoveryProgress: 0,
      })
      const result = TherapistManager.processRest(therapist, 8)

      expect(result.updatedTherapist.burnoutRecoveryProgress).toBeGreaterThan(0)
    })

    it('recovers from burnout when progress complete', () => {
      const therapist = createTestTherapist({
        status: 'burned_out',
        burnoutRecoveryProgress: 80,
        energy: 20,
      })
      const result = TherapistManager.processRest(therapist, 8)

      expect(result.recoveredFromBurnout).toBe(true)
      expect(result.updatedTherapist.status).toBe('available')
      expect(result.updatedTherapist.energy).toBe(therapist.maxEnergy)
    })

    it('transitions from break to available when energy sufficient', () => {
      const therapist = createTestTherapist({ status: 'on_break', energy: 40 })
      const result = TherapistManager.processRest(therapist, 2)

      expect(result.updatedTherapist.status).toBe('available')
    })
  })

  describe('processTraining', () => {
    it('progresses training hours', () => {
      const therapist = createTestTherapist({ status: 'in_training' })
      const program = TRAINING_PROGRAMS.cbt_training
      const training: ActiveTraining = {
        programId: program.id,
        therapistId: therapist.id,
        startDay: 1,
        hoursCompleted: 0,
        totalHours: program.durationHours,
      }

      const result = TherapistManager.processTraining(therapist, training, program, 8)

      expect(result.updatedTraining.hoursCompleted).toBe(8)
      expect(result.completed).toBe(false)
    })

    it('completes training and grants certification', () => {
      const therapist = createTestTherapist({ status: 'in_training', certifications: [] })
      const program = TRAINING_PROGRAMS.cbt_training
      const training: ActiveTraining = {
        programId: program.id,
        therapistId: therapist.id,
        startDay: 1,
        hoursCompleted: program.durationHours - 4,
        totalHours: program.durationHours,
      }

      const result = TherapistManager.processTraining(therapist, training, program, 8)

      expect(result.completed).toBe(true)
      expect(result.updatedTherapist.certifications).toContain('cbt_certified')
      expect(result.updatedTherapist.status).toBe('available')
    })

    it('grants skill bonus on completion', () => {
      const therapist = createTestTherapist({ status: 'in_training', baseSkill: 50 })
      const program = TRAINING_PROGRAMS.cbt_training // Has skillBonus: 3
      const training: ActiveTraining = {
        programId: program.id,
        therapistId: therapist.id,
        startDay: 1,
        hoursCompleted: program.durationHours - 1,
        totalHours: program.durationHours,
      }

      const result = TherapistManager.processTraining(therapist, training, program, 8)

      expect(result.updatedTherapist.baseSkill).toBe(50 + (program.grants.skillBonus ?? 0))
    })
  })

  describe('startTraining', () => {
    it('creates active training record', () => {
      const therapist = createTestTherapist()
      const program = TRAINING_PROGRAMS.telehealth_training

      const training = TherapistManager.startTraining(therapist, program, 5)

      expect(training.programId).toBe(program.id)
      expect(training.therapistId).toBe(therapist.id)
      expect(training.startDay).toBe(5)
      expect(training.hoursCompleted).toBe(0)
      expect(training.totalHours).toBe(program.durationHours)
    })
  })

  describe('setStatus', () => {
    it('updates therapist status', () => {
      const therapist = createTestTherapist({ status: 'available' })
      const result = TherapistManager.setStatus(therapist, 'in_session')

      expect(result.status).toBe('in_session')
    })
  })

  describe('getXpForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(TherapistManager.getXpForLevel(1)).toBe(0)
    })

    it('returns base XP for level 2', () => {
      expect(TherapistManager.getXpForLevel(2)).toBe(THERAPIST_CONFIG.BASE_XP_FOR_LEVEL)
    })

    it('scales XP requirement with level', () => {
      const level3 = TherapistManager.getXpForLevel(3)
      const level4 = TherapistManager.getXpForLevel(4)

      expect(level4).toBeGreaterThan(level3)
    })
  })

  describe('isBurnoutRisk', () => {
    it('returns true when energy below threshold', () => {
      const therapist = createTestTherapist({ energy: 15 })
      expect(TherapistManager.isBurnoutRisk(therapist)).toBe(true)
    })

    it('returns false when energy above threshold', () => {
      const therapist = createTestTherapist({ energy: 50 })
      expect(TherapistManager.isBurnoutRisk(therapist)).toBe(false)
    })

    it('returns false when already burned out', () => {
      const therapist = createTestTherapist({ energy: 5, status: 'burned_out' })
      expect(TherapistManager.isBurnoutRisk(therapist)).toBe(false)
    })
  })

  describe('canTakeSession', () => {
    it('returns true for available therapist with enough energy', () => {
      const therapist = createTestTherapist({ status: 'available', energy: 50 })
      expect(TherapistManager.canTakeSession(therapist, 50)).toBe(true)
    })

    it('returns false for unavailable therapist', () => {
      const therapist = createTestTherapist({ status: 'in_session', energy: 100 })
      expect(TherapistManager.canTakeSession(therapist, 50)).toBe(false)
    })

    it('returns false for insufficient energy', () => {
      const therapist = createTestTherapist({ status: 'available', energy: 10 })
      expect(TherapistManager.canTakeSession(therapist, 50)).toBe(false)
    })

    it('checks correct energy for different durations', () => {
      const therapist = createTestTherapist({ status: 'available', energy: 30 })

      expect(TherapistManager.canTakeSession(therapist, 50)).toBe(true)
      expect(TherapistManager.canTakeSession(therapist, 80)).toBe(true)
      expect(TherapistManager.canTakeSession(therapist, 180)).toBe(false)
    })
  })

  describe('canStartTraining', () => {
    it('allows training for available therapist meeting prerequisites', () => {
      const therapist = createTestTherapist({ status: 'available', baseSkill: 50 })
      const program = TRAINING_PROGRAMS.telehealth_training

      const result = TherapistManager.canStartTraining(therapist, program)

      expect(result.canStart).toBe(true)
    })

    it('rejects training for unavailable therapist', () => {
      const therapist = createTestTherapist({ status: 'in_session' })
      const program = TRAINING_PROGRAMS.telehealth_training

      const result = TherapistManager.canStartTraining(therapist, program)

      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('not available')
    })

    it('rejects training when skill too low', () => {
      const therapist = createTestTherapist({ baseSkill: 30 })
      const program = TRAINING_PROGRAMS.trauma_training // minSkill: 40

      const result = TherapistManager.canStartTraining(therapist, program)

      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('skill level')
    })

    it('rejects training when prerequisite certification missing', () => {
      const therapist = createTestTherapist({
        baseSkill: 60,
        certifications: [],
      })
      const program = TRAINING_PROGRAMS.dbt_training // requires cbt_certified

      const result = TherapistManager.canStartTraining(therapist, program)

      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('Missing certifications')
    })

    it('rejects training when already has certification', () => {
      const therapist = createTestTherapist({
        certifications: ['trauma_certified'],
      })
      const program = TRAINING_PROGRAMS.trauma_training

      const result = TherapistManager.canStartTraining(therapist, program)

      expect(result.canStart).toBe(false)
      expect(result.reason).toContain('Already has')
    })
  })

  describe('getAvailableTherapists', () => {
    it('filters to only available therapists', () => {
      const therapists = [
        createTestTherapist({ id: '1', status: 'available' }),
        createTestTherapist({ id: '2', status: 'in_session' }),
        createTestTherapist({ id: '3', status: 'available' }),
        createTestTherapist({ id: '4', status: 'burned_out' }),
      ]

      const available = TherapistManager.getAvailableTherapists(therapists)

      expect(available.length).toBe(2)
      expect(available.every((t) => t.status === 'available')).toBe(true)
    })
  })

  describe('getTherapistsBySkill', () => {
    it('sorts therapists by skill descending', () => {
      const therapists = [
        createTestTherapist({ id: '1', baseSkill: 50 }),
        createTestTherapist({ id: '2', baseSkill: 80 }),
        createTestTherapist({ id: '3', baseSkill: 30 }),
      ]

      const sorted = TherapistManager.getTherapistsBySkill(therapists)

      expect(sorted[0].baseSkill).toBe(80)
      expect(sorted[1].baseSkill).toBe(50)
      expect(sorted[2].baseSkill).toBe(30)
    })
  })

  describe('getTherapistStats', () => {
    it('returns correct counts by status', () => {
      const therapists = [
        createTestTherapist({ status: 'available' }),
        createTestTherapist({ status: 'available' }),
        createTestTherapist({ status: 'in_session' }),
        createTestTherapist({ status: 'on_break' }),
        createTestTherapist({ status: 'in_training' }),
        createTestTherapist({ status: 'burned_out' }),
      ]

      const stats = TherapistManager.getTherapistStats(therapists)

      expect(stats.total).toBe(6)
      expect(stats.available).toBe(2)
      expect(stats.inSession).toBe(1)
      expect(stats.onBreak).toBe(1)
      expect(stats.inTraining).toBe(1)
      expect(stats.burnedOut).toBe(1)
    })

    it('calculates average energy and skill', () => {
      const therapists = [
        createTestTherapist({ energy: 80, baseSkill: 60 }),
        createTestTherapist({ energy: 60, baseSkill: 40 }),
      ]

      const stats = TherapistManager.getTherapistStats(therapists)

      expect(stats.avgEnergy).toBe(70)
      expect(stats.avgSkill).toBe(50)
    })
  })

  describe('getMonthlySalaryCost', () => {
    it('calculates total salary for hired therapists', () => {
      const therapists = [
        createTestTherapist({ isPlayer: true, hourlySalary: 0 }),
        createTestTherapist({ isPlayer: false, hourlySalary: 50 }),
        createTestTherapist({ isPlayer: false, hourlySalary: 75 }),
      ]

      const cost = TherapistManager.getMonthlySalaryCost(therapists)

      // (50 + 75) * 8 hours * 22 days
      expect(cost).toBe(125 * 8 * 22)
    })

    it('excludes player from salary calculation', () => {
      const therapists = [createTestTherapist({ isPlayer: true, hourlySalary: 100 })]

      const cost = TherapistManager.getMonthlySalaryCost(therapists)

      expect(cost).toBe(0)
    })
  })

  describe('getEnergyDisplay', () => {
    it('returns good status for high energy', () => {
      const therapist = createTestTherapist({ energy: 80, maxEnergy: 100 })
      const display = TherapistManager.getEnergyDisplay(therapist)

      expect(display.percentage).toBe(80)
      expect(display.status).toBe('good')
    })

    it('returns warning status for medium energy', () => {
      const therapist = createTestTherapist({ energy: 35, maxEnergy: 100 })
      const display = TherapistManager.getEnergyDisplay(therapist)

      expect(display.status).toBe('warning')
    })

    it('returns critical status for low energy', () => {
      const therapist = createTestTherapist({ energy: 15, maxEnergy: 100 })
      const display = TherapistManager.getEnergyDisplay(therapist)

      expect(display.status).toBe('critical')
    })
  })

  describe('formatTherapistSummary', () => {
    it('formats therapist summary correctly', () => {
      const therapist = createTestTherapist({
        displayName: 'Dr. Jane Smith',
        level: 10,
        baseSkill: 75,
      })

      const summary = TherapistManager.formatTherapistSummary(therapist)

      expect(summary).toBe('Dr. Jane Smith - Level 10 (Skill: 75)')
    })
  })
})
