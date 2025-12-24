import { describe, it, expect } from 'vitest'
import { applyIdleEnergyRecovery, THERAPIST_CONFIG } from '@/core/therapists'
import type { Therapist } from '@/core/types'

function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 't1',
    displayName: 'Dr. Test',
    isPlayer: false,
    energy: 50,
    maxEnergy: 100,
    baseSkill: 50,
    level: 1,
    xp: 0,
    hourlySalary: 50,
    hireDay: 1,
    certifications: [],
    specializations: ['stress_management'],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 5, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

describe('applyIdleEnergyRecovery', () => {
  it('recovers energy at the configured per-hour rate', () => {
    const therapist = createTherapist({ energy: 50 })

    const result = applyIdleEnergyRecovery(therapist, 60, 0)

    expect(result.updatedTherapist.energy).toBe(50 + THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR)
    expect(result.energyRecovered).toBe(THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR)
    expect(result.remainderUnits).toBe(0)
  })

  it('accumulates fractional recovery via remainder and only applies integers', () => {
    const therapist = createTherapist({ energy: 50 })

    // 1 minute -> 10/60 energy = 0.166..., should not change energy yet
    const r1 = applyIdleEnergyRecovery(therapist, 1, 0)
    expect(r1.updatedTherapist.energy).toBe(50)
    expect(r1.energyRecovered).toBe(0)
    expect(r1.remainderUnits).toBe(THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR)

    // Next 5 minutes: total 1 energy (0.166... * 6 = 1)
    const r2 = applyIdleEnergyRecovery(r1.updatedTherapist, 5, r1.remainderUnits)
    expect(r2.updatedTherapist.energy).toBe(51)
    expect(r2.energyRecovered).toBe(1)
    expect(r2.remainderUnits).toBe(0)
  })

  it('never exceeds maxEnergy and clears remainder when capped', () => {
    const therapist = createTherapist({ energy: 99, maxEnergy: 100 })

    const result = applyIdleEnergyRecovery(therapist, 60, 55)

    expect(result.updatedTherapist.energy).toBe(100)
    expect(result.energyRecovered).toBe(1)
    expect(result.remainderUnits).toBe(0)
  })

  it('does nothing when idleMinutes is 0 or less', () => {
    const therapist = createTherapist({ energy: 50 })

    const result = applyIdleEnergyRecovery(therapist, 0, 30)

    expect(result.updatedTherapist.energy).toBe(50)
    expect(result.energyRecovered).toBe(0)
    expect(result.remainderUnits).toBe(30)
  })

  it('does not bank recovery when already at max energy', () => {
    const therapist = createTherapist({ energy: 100, maxEnergy: 100 })

    const result = applyIdleEnergyRecovery(therapist, 120, 45)

    expect(result.updatedTherapist.energy).toBe(100)
    expect(result.energyRecovered).toBe(0)
    expect(result.remainderUnits).toBe(0)
  })
})
