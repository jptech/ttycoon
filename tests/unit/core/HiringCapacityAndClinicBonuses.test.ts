/**
 * Tests for hiring capacity limits and clinic bonus persistence.
 *
 * These tests verify:
 * 1. Hiring capacity is enforced based on practice level + training bonuses
 * 2. Clinic bonuses (insurance_multiplier, hiring_capacity) are persisted in state
 * 3. State is properly initialized and can be loaded/saved
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { getPracticeLevelConfig } from '@/core/types'

describe('Hiring Capacity Limits', () => {
  beforeEach(() => {
    // Reset to initial state values
    useGameStore.setState({
      hiringCapacityBonus: 0,
      insuranceMultiplier: 1.0,
      practiceLevel: 1,
    })
  })

  describe('getPracticeLevelConfig', () => {
    it('returns correct staff cap for each practice level', () => {
      // Actual staff caps from PRACTICE_LEVELS in state.ts
      expect(getPracticeLevelConfig(1).staffCap).toBe(1)
      expect(getPracticeLevelConfig(2).staffCap).toBe(2)
      expect(getPracticeLevelConfig(3).staffCap).toBe(3)
      expect(getPracticeLevelConfig(4).staffCap).toBe(4)
      expect(getPracticeLevelConfig(5).staffCap).toBe(5)
    })

    it('staff cap increases with each level', () => {
      // Verify the progression
      for (let level = 2; level <= 5; level++) {
        const currentCap = getPracticeLevelConfig(level as 1 | 2 | 3 | 4 | 5).staffCap
        const previousCap = getPracticeLevelConfig((level - 1) as 1 | 2 | 3 | 4 | 5).staffCap
        expect(currentCap).toBeGreaterThan(previousCap)
      }
    })
  })

  describe('hiringCapacityBonus state', () => {
    it('initializes hiringCapacityBonus to 0', () => {
      const state = useGameStore.getState()
      expect(state.hiringCapacityBonus).toBe(0)
    })

    it('addHiringCapacityBonus increases the bonus', () => {
      const { addHiringCapacityBonus } = useGameStore.getState()

      addHiringCapacityBonus(1)
      expect(useGameStore.getState().hiringCapacityBonus).toBe(1)

      addHiringCapacityBonus(2)
      expect(useGameStore.getState().hiringCapacityBonus).toBe(3)
    })

    it('hiringCapacityBonus persists in getState()', () => {
      const { addHiringCapacityBonus } = useGameStore.getState()
      addHiringCapacityBonus(5)

      const fullState = useGameStore.getState().getState()
      expect(fullState.hiringCapacityBonus).toBe(5)
    })
  })

  describe('max therapists calculation', () => {
    it('calculates max therapists from level config + bonus', () => {
      const state = useGameStore.getState()

      // Level 1 with no bonus
      expect(getPracticeLevelConfig(1).staffCap + state.hiringCapacityBonus).toBe(1)

      // Add bonus
      state.addHiringCapacityBonus(2)

      // Now should be 1 + 2 = 3
      const newState = useGameStore.getState()
      expect(getPracticeLevelConfig(1).staffCap + newState.hiringCapacityBonus).toBe(3)
    })

    it('bonus stacks with higher practice levels', () => {
      const { addHiringCapacityBonus } = useGameStore.getState()

      // Add bonus
      addHiringCapacityBonus(3)

      const state = useGameStore.getState()
      // Level 5 cap (5) + bonus (3) = 8
      expect(getPracticeLevelConfig(5).staffCap + state.hiringCapacityBonus).toBe(8)
    })
  })
})

describe('Clinic Bonus Persistence', () => {
  beforeEach(() => {
    // Reset to initial state values
    useGameStore.setState({
      hiringCapacityBonus: 0,
      insuranceMultiplier: 1.0,
    })
  })

  describe('insuranceMultiplier', () => {
    it('initializes insuranceMultiplier to 1.0', () => {
      const state = useGameStore.getState()
      expect(state.insuranceMultiplier).toBe(1.0)
    })

    it('setInsuranceMultiplier updates the value', () => {
      const { setInsuranceMultiplier } = useGameStore.getState()

      setInsuranceMultiplier(1.1)
      expect(useGameStore.getState().insuranceMultiplier).toBe(1.1)

      setInsuranceMultiplier(1.25)
      expect(useGameStore.getState().insuranceMultiplier).toBe(1.25)
    })

    it('insuranceMultiplier persists in getState()', () => {
      const { setInsuranceMultiplier } = useGameStore.getState()
      setInsuranceMultiplier(1.15)

      const fullState = useGameStore.getState().getState()
      expect(fullState.insuranceMultiplier).toBe(1.15)
    })
  })

  describe('state persistence via loadState', () => {
    it('loads hiringCapacityBonus from saved state', () => {
      const { loadState, getState } = useGameStore.getState()

      // Create a mock saved state
      const savedState = {
        ...getState(),
        hiringCapacityBonus: 5,
      }

      loadState(savedState)

      expect(useGameStore.getState().hiringCapacityBonus).toBe(5)
    })

    it('loads insuranceMultiplier from saved state', () => {
      const { loadState, getState } = useGameStore.getState()

      const savedState = {
        ...getState(),
        insuranceMultiplier: 1.3,
      }

      loadState(savedState)

      expect(useGameStore.getState().insuranceMultiplier).toBe(1.3)
    })

    it('loads both bonuses together', () => {
      const { loadState, getState } = useGameStore.getState()

      const savedState = {
        ...getState(),
        hiringCapacityBonus: 3,
        insuranceMultiplier: 1.2,
      }

      loadState(savedState)

      const state = useGameStore.getState()
      expect(state.hiringCapacityBonus).toBe(3)
      expect(state.insuranceMultiplier).toBe(1.2)
    })
  })
})

describe('Integration: Training Bonuses Applied', () => {
  beforeEach(() => {
    // Reset to initial state values
    useGameStore.setState({
      hiringCapacityBonus: 0,
      insuranceMultiplier: 1.0,
      practiceLevel: 1,
    })
  })

  it('hiring_capacity bonus increases max therapists', () => {
    const initialMaxTherapists =
      getPracticeLevelConfig(1).staffCap + useGameStore.getState().hiringCapacityBonus

    // Simulate training completion granting hiring_capacity bonus
    useGameStore.getState().addHiringCapacityBonus(2)

    const newMaxTherapists =
      getPracticeLevelConfig(1).staffCap + useGameStore.getState().hiringCapacityBonus

    expect(newMaxTherapists).toBe(initialMaxTherapists + 2)
  })

  it('insurance_multiplier bonus increases insurance payments', () => {
    const baseMultiplier = useGameStore.getState().insuranceMultiplier

    // Simulate training completion granting insurance_multiplier bonus
    const bonusValue = 0.1
    useGameStore.getState().setInsuranceMultiplier(baseMultiplier + bonusValue)

    const newMultiplier = useGameStore.getState().insuranceMultiplier

    expect(newMultiplier).toBe(baseMultiplier + bonusValue)
    expect(newMultiplier).toBe(1.1)
  })
})
