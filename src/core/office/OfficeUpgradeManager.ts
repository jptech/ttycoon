import type {
  OfficeUpgradeId,
  OfficeUpgradeConfig,
  BuildingUpgradeState,
  AggregatedUpgradeEffects,
  OfficeUpgradeLine,
} from '@/core/types'
import { OFFICE_UPGRADES, getUpgradeConfig, getUpgradesByLine } from './upgradeConfigs'
import { DEFAULT_UPGRADE_EFFECTS } from '@/core/types/office'

export interface PurchaseResult {
  success: boolean
  reason?: string
}

/**
 * Manager for office upgrades
 * Handles purchase validation, prerequisite checking, and effect aggregation
 */
export const OfficeUpgradeManager = {
  /**
   * Check if a specific upgrade can be purchased
   */
  canPurchase(
    upgradeId: OfficeUpgradeId,
    state: BuildingUpgradeState,
    money: number
  ): PurchaseResult {
    const upgrade = getUpgradeConfig(upgradeId)

    // Check if already purchased
    if (state.purchasedUpgrades.includes(upgradeId)) {
      return { success: false, reason: 'Already purchased' }
    }

    // Check prerequisite
    if (upgrade.prerequisite && !state.purchasedUpgrades.includes(upgrade.prerequisite)) {
      const prereq = getUpgradeConfig(upgrade.prerequisite)
      return { success: false, reason: `Requires ${prereq.name} first` }
    }

    // Check money
    if (money < upgrade.cost) {
      return { success: false, reason: 'Not enough money' }
    }

    return { success: true }
  },

  /**
   * Get all upgrades that can currently be purchased
   */
  getAvailableUpgrades(state: BuildingUpgradeState, money: number): OfficeUpgradeConfig[] {
    return Object.values(OFFICE_UPGRADES).filter(
      (upgrade) => this.canPurchase(upgrade.id, state, money).success
    )
  },

  /**
   * Get the current status of an upgrade
   */
  getUpgradeStatus(
    upgradeId: OfficeUpgradeId,
    state: BuildingUpgradeState
  ): 'purchased' | 'available' | 'locked' {
    if (state.purchasedUpgrades.includes(upgradeId)) {
      return 'purchased'
    }

    const upgrade = getUpgradeConfig(upgradeId)
    if (upgrade.prerequisite && !state.purchasedUpgrades.includes(upgrade.prerequisite)) {
      return 'locked'
    }

    return 'available'
  },

  /**
   * Get the highest tier purchased in a specific upgrade line
   */
  getHighestTierInLine(line: OfficeUpgradeLine, state: BuildingUpgradeState): number {
    const lineUpgrades = getUpgradesByLine(line)
    let highestTier = 0

    for (const upgrade of lineUpgrades) {
      if (state.purchasedUpgrades.includes(upgrade.id) && upgrade.tier > highestTier) {
        highestTier = upgrade.tier
      }
    }

    return highestTier
  },

  /**
   * Calculate aggregated effects from all purchased upgrades
   * For same line: only highest tier applies
   * For different lines: effects combine additively
   */
  getAggregatedEffects(state: BuildingUpgradeState): AggregatedUpgradeEffects {
    const effects: AggregatedUpgradeEffects = { ...DEFAULT_UPGRADE_EFFECTS }

    // Group purchased upgrades by line and find highest tier for each
    const lineEffects: Map<OfficeUpgradeLine, OfficeUpgradeConfig> = new Map()

    for (const upgradeId of state.purchasedUpgrades) {
      const upgrade = getUpgradeConfig(upgradeId)
      const existing = lineEffects.get(upgrade.line)

      if (!existing || upgrade.tier > existing.tier) {
        lineEffects.set(upgrade.line, upgrade)
      }
    }

    // Apply effects from highest tier of each line
    for (const upgrade of lineEffects.values()) {
      const { effects: upgradeEffects } = upgrade

      // Energy effects are multipliers - take the value directly (only one per line)
      if (upgradeEffects.idleEnergyRecoveryMultiplier !== undefined) {
        effects.idleEnergyRecoveryMultiplier = upgradeEffects.idleEnergyRecoveryMultiplier
      }
      if (upgradeEffects.breakEnergyRecoveryMultiplier !== undefined) {
        effects.breakEnergyRecoveryMultiplier = upgradeEffects.breakEnergyRecoveryMultiplier
      }

      // Quality and comfort are additive across different lines
      if (upgradeEffects.sessionQualityBonus !== undefined) {
        effects.sessionQualityBonus += upgradeEffects.sessionQualityBonus
      }
      if (upgradeEffects.waitingSatisfactionDecayReduction !== undefined) {
        effects.waitingSatisfactionDecayReduction += upgradeEffects.waitingSatisfactionDecayReduction
      }
    }

    return effects
  },

  /**
   * Get session quality bonus from upgrades
   */
  getSessionQualityBonus(state: BuildingUpgradeState): number {
    return this.getAggregatedEffects(state).sessionQualityBonus
  },

  /**
   * Get waiting satisfaction decay reduction from upgrades
   */
  getWaitingDecayReduction(state: BuildingUpgradeState): number {
    return this.getAggregatedEffects(state).waitingSatisfactionDecayReduction
  },

  /**
   * Get idle energy recovery multiplier from upgrades
   */
  getIdleEnergyMultiplier(state: BuildingUpgradeState): number {
    return this.getAggregatedEffects(state).idleEnergyRecoveryMultiplier
  },

  /**
   * Get break energy recovery multiplier from upgrades
   */
  getBreakEnergyMultiplier(state: BuildingUpgradeState): number {
    return this.getAggregatedEffects(state).breakEnergyRecoveryMultiplier
  },

  /**
   * Get total money invested in upgrades
   */
  getTotalInvested(state: BuildingUpgradeState): number {
    return state.purchasedUpgrades.reduce((total, id) => {
      return total + getUpgradeConfig(id).cost
    }, 0)
  },

  /**
   * Get count of purchased upgrades
   */
  getPurchasedCount(state: BuildingUpgradeState): number {
    return state.purchasedUpgrades.length
  },

  /**
   * Format effect for display
   */
  formatEffect(upgrade: OfficeUpgradeConfig): string {
    const { effects } = upgrade
    const parts: string[] = []

    if (effects.idleEnergyRecoveryMultiplier !== undefined) {
      const bonus = Math.round((effects.idleEnergyRecoveryMultiplier - 1) * 100)
      parts.push(`+${bonus}% idle energy recovery`)
    }
    if (effects.breakEnergyRecoveryMultiplier !== undefined) {
      const bonus = Math.round((effects.breakEnergyRecoveryMultiplier - 1) * 100)
      parts.push(`+${bonus}% break energy recovery`)
    }
    if (effects.sessionQualityBonus !== undefined) {
      const bonus = Math.round(effects.sessionQualityBonus * 100)
      parts.push(`+${bonus}% session quality`)
    }
    if (effects.waitingSatisfactionDecayReduction !== undefined) {
      parts.push(`-${effects.waitingSatisfactionDecayReduction} waiting decay/hr`)
    }

    return parts.join(', ')
  },
}
