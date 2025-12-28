// ================== OFFICE UPGRADES ==================

/**
 * Unique identifier for each office upgrade tier
 */
export type OfficeUpgradeId =
  // Energy/Breaks
  | 'coffee_machine_1' | 'coffee_machine_2' | 'coffee_machine_3'
  | 'kitchenette_1' | 'kitchenette_2' | 'kitchenette_3'
  // Session Quality
  | 'artwork_1' | 'artwork_2' | 'artwork_3'
  | 'sound_system_1' | 'sound_system_2' | 'sound_system_3'
  // Client Comfort
  | 'waiting_comfort_1' | 'waiting_comfort_2' | 'waiting_comfort_3'
  | 'refreshments_1' | 'refreshments_2' | 'refreshments_3'

/**
 * Category of office upgrade
 */
export type OfficeUpgradeCategory = 'energy' | 'quality' | 'comfort'

/**
 * Upgrade line identifier (groups related tiers)
 */
export type OfficeUpgradeLine =
  | 'coffee_machine'
  | 'kitchenette'
  | 'artwork'
  | 'sound_system'
  | 'waiting_comfort'
  | 'refreshments'

/**
 * Effects provided by an office upgrade
 */
export interface OfficeUpgradeEffects {
  /** Multiplier for energy recovery during idle work hours (1.0 = no change) */
  idleEnergyRecoveryMultiplier?: number
  /** Multiplier for energy recovery during designated breaks (1.0 = no change) */
  breakEnergyRecoveryMultiplier?: number
  /** Additive bonus to session quality (0-1 scale, e.g., 0.02 = +2%) */
  sessionQualityBonus?: number
  /** Absolute reduction in waiting satisfaction decay per hour */
  waitingSatisfactionDecayReduction?: number
}

/**
 * Configuration for a single office upgrade
 */
export interface OfficeUpgradeConfig {
  id: OfficeUpgradeId
  name: string
  description: string
  category: OfficeUpgradeCategory
  tier: 1 | 2 | 3
  line: OfficeUpgradeLine
  cost: number
  /** Previous tier in the same line that must be purchased first */
  prerequisite?: OfficeUpgradeId
  effects: OfficeUpgradeEffects
}

/**
 * State of purchased upgrades for the current building
 * Upgrades are lost when upgrading to a new building tier
 */
export interface BuildingUpgradeState {
  purchasedUpgrades: OfficeUpgradeId[]
}

/**
 * Aggregated effects from all purchased upgrades
 */
export interface AggregatedUpgradeEffects {
  idleEnergyRecoveryMultiplier: number
  breakEnergyRecoveryMultiplier: number
  sessionQualityBonus: number
  waitingSatisfactionDecayReduction: number
}

/**
 * Default state for building upgrades
 */
export const DEFAULT_BUILDING_UPGRADE_STATE: BuildingUpgradeState = {
  purchasedUpgrades: [],
}

/**
 * Default aggregated effects (no upgrades)
 */
export const DEFAULT_UPGRADE_EFFECTS: AggregatedUpgradeEffects = {
  idleEnergyRecoveryMultiplier: 1.0,
  breakEnergyRecoveryMultiplier: 1.0,
  sessionQualityBonus: 0,
  waitingSatisfactionDecayReduction: 0,
}
