import { describe, it, expect } from 'vitest'
import { OfficeUpgradeManager, getUpgradeConfig, getUpgradesByLine } from '@/core/office'
import type { BuildingUpgradeState, OfficeUpgradeId } from '@/core/types'
import { DEFAULT_UPGRADE_EFFECTS } from '@/core/types/office'

// ==================== TEST HELPERS ====================

const createUpgradeState = (purchasedUpgrades: OfficeUpgradeId[] = []): BuildingUpgradeState => ({
  purchasedUpgrades,
})

// ==================== PURCHASE VALIDATION ====================

describe('OfficeUpgradeManager - canPurchase', () => {
  it('should allow purchasing first tier upgrade with sufficient money', () => {
    const state = createUpgradeState([])
    const result = OfficeUpgradeManager.canPurchase('coffee_machine_1', state, 1000)

    expect(result.success).toBe(true)
  })

  it('should reject when already purchased', () => {
    const state = createUpgradeState(['coffee_machine_1'])
    const result = OfficeUpgradeManager.canPurchase('coffee_machine_1', state, 1000)

    expect(result.success).toBe(false)
    expect(result.reason).toBe('Already purchased')
  })

  it('should reject when prerequisite not met', () => {
    const state = createUpgradeState([])
    const result = OfficeUpgradeManager.canPurchase('coffee_machine_2', state, 10000)

    expect(result.success).toBe(false)
    expect(result.reason).toContain('Requires')
  })

  it('should allow purchasing when prerequisite is met', () => {
    const state = createUpgradeState(['coffee_machine_1'])
    const result = OfficeUpgradeManager.canPurchase('coffee_machine_2', state, 10000)

    expect(result.success).toBe(true)
  })

  it('should reject when insufficient money', () => {
    const state = createUpgradeState([])
    const result = OfficeUpgradeManager.canPurchase('coffee_machine_1', state, 100)

    expect(result.success).toBe(false)
    expect(result.reason).toBe('Not enough money')
  })
})

// ==================== UPGRADE STATUS ====================

describe('OfficeUpgradeManager - getUpgradeStatus', () => {
  it('should return purchased for owned upgrades', () => {
    const state = createUpgradeState(['artwork_1'])
    const status = OfficeUpgradeManager.getUpgradeStatus('artwork_1', state)

    expect(status).toBe('purchased')
  })

  it('should return available for first tier upgrades', () => {
    const state = createUpgradeState([])
    const status = OfficeUpgradeManager.getUpgradeStatus('artwork_1', state)

    expect(status).toBe('available')
  })

  it('should return locked for upgrades without prerequisite', () => {
    const state = createUpgradeState([])
    const status = OfficeUpgradeManager.getUpgradeStatus('artwork_2', state)

    expect(status).toBe('locked')
  })

  it('should return available when prerequisite is purchased', () => {
    const state = createUpgradeState(['artwork_1'])
    const status = OfficeUpgradeManager.getUpgradeStatus('artwork_2', state)

    expect(status).toBe('available')
  })
})

// ==================== EFFECT AGGREGATION ====================

describe('OfficeUpgradeManager - getAggregatedEffects', () => {
  it('should return default effects when no upgrades', () => {
    const state = createUpgradeState([])
    const effects = OfficeUpgradeManager.getAggregatedEffects(state)

    expect(effects).toEqual(DEFAULT_UPGRADE_EFFECTS)
  })

  it('should apply single upgrade effect', () => {
    const state = createUpgradeState(['coffee_machine_1'])
    const effects = OfficeUpgradeManager.getAggregatedEffects(state)

    expect(effects.idleEnergyRecoveryMultiplier).toBe(1.1)
  })

  it('should only use highest tier in same line', () => {
    const state = createUpgradeState(['coffee_machine_1', 'coffee_machine_2', 'coffee_machine_3'])
    const effects = OfficeUpgradeManager.getAggregatedEffects(state)

    // Only tier 3 effect should apply (1.3), not cumulative
    expect(effects.idleEnergyRecoveryMultiplier).toBe(1.3)
  })

  it('should combine effects from different lines additively', () => {
    const state = createUpgradeState(['artwork_1', 'sound_system_1'])
    const effects = OfficeUpgradeManager.getAggregatedEffects(state)

    // artwork_1 = +2%, sound_system_1 = +1%, total = +3%
    expect(effects.sessionQualityBonus).toBeCloseTo(0.03)
  })

  it('should combine waiting decay reduction from different lines', () => {
    const state = createUpgradeState(['waiting_comfort_1', 'refreshments_1'])
    const effects = OfficeUpgradeManager.getAggregatedEffects(state)

    // waiting_comfort_1 = -0.3, refreshments_1 = -0.2, total = -0.5
    expect(effects.waitingSatisfactionDecayReduction).toBeCloseTo(0.5)
  })
})

// ==================== HELPER METHODS ====================

describe('OfficeUpgradeManager - Helper Methods', () => {
  it('should get session quality bonus', () => {
    const state = createUpgradeState(['artwork_2'])
    const bonus = OfficeUpgradeManager.getSessionQualityBonus(state)

    expect(bonus).toBe(0.04)
  })

  it('should get waiting decay reduction', () => {
    const state = createUpgradeState(['waiting_comfort_3'])
    const reduction = OfficeUpgradeManager.getWaitingDecayReduction(state)

    expect(reduction).toBe(1.0)
  })

  it('should get idle energy multiplier', () => {
    const state = createUpgradeState(['coffee_machine_2'])
    const multiplier = OfficeUpgradeManager.getIdleEnergyMultiplier(state)

    expect(multiplier).toBe(1.2)
  })

  it('should get break energy multiplier', () => {
    const state = createUpgradeState(['kitchenette_2'])
    const multiplier = OfficeUpgradeManager.getBreakEnergyMultiplier(state)

    expect(multiplier).toBe(1.3)
  })

  it('should calculate total invested', () => {
    // coffee_machine_1 = $500, artwork_1 = $300
    const state = createUpgradeState(['coffee_machine_1', 'artwork_1'])
    const total = OfficeUpgradeManager.getTotalInvested(state)

    expect(total).toBe(800)
  })

  it('should get purchased count', () => {
    const state = createUpgradeState(['coffee_machine_1', 'artwork_1', 'sound_system_1'])
    const count = OfficeUpgradeManager.getPurchasedCount(state)

    expect(count).toBe(3)
  })
})

// ==================== AVAILABLE UPGRADES ====================

describe('OfficeUpgradeManager - getAvailableUpgrades', () => {
  it('should return all tier 1 upgrades when nothing purchased', () => {
    const state = createUpgradeState([])
    const available = OfficeUpgradeManager.getAvailableUpgrades(state, 10000)

    // Should only include tier 1 upgrades (6 lines = 6 tier 1 upgrades)
    expect(available.length).toBe(6)
    expect(available.every(u => u.tier === 1)).toBe(true)
  })

  it('should include tier 2 when tier 1 is purchased', () => {
    const state = createUpgradeState(['coffee_machine_1'])
    const available = OfficeUpgradeManager.getAvailableUpgrades(state, 10000)

    // Should include coffee_machine_2 now
    expect(available.some(u => u.id === 'coffee_machine_2')).toBe(true)
  })

  it('should exclude upgrades player cannot afford', () => {
    const state = createUpgradeState([])
    const available = OfficeUpgradeManager.getAvailableUpgrades(state, 100)

    // Only refreshments_1 costs $150, all others cost more
    expect(available.length).toBe(0)
  })
})

// ==================== HIGHEST TIER IN LINE ====================

describe('OfficeUpgradeManager - getHighestTierInLine', () => {
  it('should return 0 when no upgrades in line', () => {
    const state = createUpgradeState([])
    const tier = OfficeUpgradeManager.getHighestTierInLine('coffee_machine', state)

    expect(tier).toBe(0)
  })

  it('should return correct tier', () => {
    const state = createUpgradeState(['coffee_machine_1', 'coffee_machine_2'])
    const tier = OfficeUpgradeManager.getHighestTierInLine('coffee_machine', state)

    expect(tier).toBe(2)
  })
})

// ==================== FORMAT EFFECT ====================

describe('OfficeUpgradeManager - formatEffect', () => {
  it('should format idle energy effect', () => {
    const upgrade = getUpgradeConfig('coffee_machine_1')
    const formatted = OfficeUpgradeManager.formatEffect(upgrade)

    expect(formatted).toContain('+10% idle energy recovery')
  })

  it('should format break energy effect', () => {
    const upgrade = getUpgradeConfig('kitchenette_1')
    const formatted = OfficeUpgradeManager.formatEffect(upgrade)

    expect(formatted).toContain('+15% break energy recovery')
  })

  it('should format session quality effect', () => {
    const upgrade = getUpgradeConfig('artwork_1')
    const formatted = OfficeUpgradeManager.formatEffect(upgrade)

    expect(formatted).toContain('+2% session quality')
  })

  it('should format waiting decay effect', () => {
    const upgrade = getUpgradeConfig('waiting_comfort_1')
    const formatted = OfficeUpgradeManager.formatEffect(upgrade)

    expect(formatted).toContain('-0.3 waiting decay/hr')
  })
})

// ==================== UPGRADE CONFIG ====================

describe('Upgrade Configs', () => {
  it('should have valid tier progression for all lines', () => {
    const lines = ['coffee_machine', 'kitchenette', 'artwork', 'sound_system', 'waiting_comfort', 'refreshments']

    for (const line of lines) {
      const upgrades = getUpgradesByLine(line)

      expect(upgrades.length).toBe(3) // Each line has 3 tiers
      expect(upgrades[0].tier).toBe(1)
      expect(upgrades[1].tier).toBe(2)
      expect(upgrades[2].tier).toBe(3)

      // Check prerequisites
      expect(upgrades[0].prerequisite).toBeUndefined()
      expect(upgrades[1].prerequisite).toBe(upgrades[0].id)
      expect(upgrades[2].prerequisite).toBe(upgrades[1].id)
    }
  })

  it('should have increasing costs per tier', () => {
    const lines = ['coffee_machine', 'kitchenette', 'artwork', 'sound_system', 'waiting_comfort', 'refreshments']

    for (const line of lines) {
      const upgrades = getUpgradesByLine(line)

      expect(upgrades[0].cost).toBeLessThan(upgrades[1].cost)
      expect(upgrades[1].cost).toBeLessThan(upgrades[2].cost)
    }
  })
})
