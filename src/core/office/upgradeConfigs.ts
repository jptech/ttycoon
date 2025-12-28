import type { OfficeUpgradeConfig, OfficeUpgradeId } from '@/core/types'

/**
 * All available office upgrades
 * Organized by category, then by line, then by tier
 */
export const OFFICE_UPGRADES: Record<OfficeUpgradeId, OfficeUpgradeConfig> = {
  // ================== ENERGY/BREAKS CATEGORY ==================

  // Coffee Machine Line - Idle energy recovery
  coffee_machine_1: {
    id: 'coffee_machine_1',
    name: 'Coffee Maker',
    description: 'A basic coffee maker keeps therapists energized between sessions.',
    category: 'energy',
    tier: 1,
    line: 'coffee_machine',
    cost: 500,
    effects: {
      idleEnergyRecoveryMultiplier: 1.1, // +10%
    },
  },
  coffee_machine_2: {
    id: 'coffee_machine_2',
    name: 'Espresso Machine',
    description: 'Premium espresso provides a better energy boost throughout the day.',
    category: 'energy',
    tier: 2,
    line: 'coffee_machine',
    cost: 1500,
    prerequisite: 'coffee_machine_1',
    effects: {
      idleEnergyRecoveryMultiplier: 1.2, // +20%
    },
  },
  coffee_machine_3: {
    id: 'coffee_machine_3',
    name: 'Barista Station',
    description: 'A full barista station with multiple brewing options for maximum energy.',
    category: 'energy',
    tier: 3,
    line: 'coffee_machine',
    cost: 4000,
    prerequisite: 'coffee_machine_2',
    effects: {
      idleEnergyRecoveryMultiplier: 1.3, // +30%
    },
  },

  // Kitchenette Line - Break energy recovery
  kitchenette_1: {
    id: 'kitchenette_1',
    name: 'Mini Fridge',
    description: 'Keep healthy snacks on hand for better break-time recovery.',
    category: 'energy',
    tier: 1,
    line: 'kitchenette',
    cost: 400,
    effects: {
      breakEnergyRecoveryMultiplier: 1.15, // +15%
    },
  },
  kitchenette_2: {
    id: 'kitchenette_2',
    name: 'Kitchenette',
    description: 'A small kitchen area with microwave and sink for proper meal breaks.',
    category: 'energy',
    tier: 2,
    line: 'kitchenette',
    cost: 1200,
    prerequisite: 'kitchenette_1',
    effects: {
      breakEnergyRecoveryMultiplier: 1.3, // +30%
    },
  },
  kitchenette_3: {
    id: 'kitchenette_3',
    name: 'Full Kitchen',
    description: 'A complete kitchen with all amenities for the best break-time experience.',
    category: 'energy',
    tier: 3,
    line: 'kitchenette',
    cost: 3500,
    prerequisite: 'kitchenette_2',
    effects: {
      breakEnergyRecoveryMultiplier: 1.5, // +50%
    },
  },

  // ================== SESSION QUALITY CATEGORY ==================

  // Artwork Line - Session quality from aesthetics
  artwork_1: {
    id: 'artwork_1',
    name: 'Calming Prints',
    description: 'Soothing artwork creates a more therapeutic atmosphere.',
    category: 'quality',
    tier: 1,
    line: 'artwork',
    cost: 300,
    effects: {
      sessionQualityBonus: 0.02, // +2%
    },
  },
  artwork_2: {
    id: 'artwork_2',
    name: 'Original Artwork',
    description: 'Curated original pieces elevate the therapeutic environment.',
    category: 'quality',
    tier: 2,
    line: 'artwork',
    cost: 1000,
    prerequisite: 'artwork_1',
    effects: {
      sessionQualityBonus: 0.04, // +4%
    },
  },
  artwork_3: {
    id: 'artwork_3',
    name: 'Curated Gallery',
    description: 'A thoughtfully curated gallery transforms the space into a healing sanctuary.',
    category: 'quality',
    tier: 3,
    line: 'artwork',
    cost: 3000,
    prerequisite: 'artwork_2',
    effects: {
      sessionQualityBonus: 0.07, // +7%
    },
  },

  // Sound System Line - Session quality from audio environment
  sound_system_1: {
    id: 'sound_system_1',
    name: 'White Noise Machine',
    description: 'Masks outside noise for better client focus and privacy.',
    category: 'quality',
    tier: 1,
    line: 'sound_system',
    cost: 200,
    effects: {
      sessionQualityBonus: 0.01, // +1%
    },
  },
  sound_system_2: {
    id: 'sound_system_2',
    name: 'Ambient Sound System',
    description: 'Professional sound system with calming ambient options.',
    category: 'quality',
    tier: 2,
    line: 'sound_system',
    cost: 800,
    prerequisite: 'sound_system_1',
    effects: {
      sessionQualityBonus: 0.03, // +3%
    },
  },
  sound_system_3: {
    id: 'sound_system_3',
    name: 'Acoustic Treatment',
    description: 'Full acoustic treatment ensures complete sound privacy and comfort.',
    category: 'quality',
    tier: 3,
    line: 'sound_system',
    cost: 2500,
    prerequisite: 'sound_system_2',
    effects: {
      sessionQualityBonus: 0.05, // +5%
    },
  },

  // ================== CLIENT COMFORT CATEGORY ==================

  // Waiting Comfort Line - Reduce waiting dissatisfaction
  waiting_comfort_1: {
    id: 'waiting_comfort_1',
    name: 'Comfortable Seating',
    description: 'Ergonomic chairs make the wait more pleasant for clients.',
    category: 'comfort',
    tier: 1,
    line: 'waiting_comfort',
    cost: 400,
    effects: {
      waitingSatisfactionDecayReduction: 0.3,
    },
  },
  waiting_comfort_2: {
    id: 'waiting_comfort_2',
    name: 'Lounge Furniture',
    description: 'Comfortable couches and relaxation areas improve client mood.',
    category: 'comfort',
    tier: 2,
    line: 'waiting_comfort',
    cost: 1200,
    prerequisite: 'waiting_comfort_1',
    effects: {
      waitingSatisfactionDecayReduction: 0.6,
    },
  },
  waiting_comfort_3: {
    id: 'waiting_comfort_3',
    name: 'Premium Waiting Area',
    description: 'A luxurious waiting area that clients actually enjoy.',
    category: 'comfort',
    tier: 3,
    line: 'waiting_comfort',
    cost: 3000,
    prerequisite: 'waiting_comfort_2',
    effects: {
      waitingSatisfactionDecayReduction: 1.0,
    },
  },

  // Refreshments Line - Additional waiting comfort
  refreshments_1: {
    id: 'refreshments_1',
    name: 'Water Cooler',
    description: 'Fresh water available for waiting clients.',
    category: 'comfort',
    tier: 1,
    line: 'refreshments',
    cost: 150,
    effects: {
      waitingSatisfactionDecayReduction: 0.2,
    },
  },
  refreshments_2: {
    id: 'refreshments_2',
    name: 'Tea & Coffee Station',
    description: 'Hot beverages to help clients relax while waiting.',
    category: 'comfort',
    tier: 2,
    line: 'refreshments',
    cost: 500,
    prerequisite: 'refreshments_1',
    effects: {
      waitingSatisfactionDecayReduction: 0.4,
    },
  },
  refreshments_3: {
    id: 'refreshments_3',
    name: 'Refreshment Bar',
    description: 'A full refreshment bar with snacks and beverages.',
    category: 'comfort',
    tier: 3,
    line: 'refreshments',
    cost: 1500,
    prerequisite: 'refreshments_2',
    effects: {
      waitingSatisfactionDecayReduction: 0.7,
    },
  },
}

/**
 * Get all upgrades as an array
 */
export function getAllUpgrades(): OfficeUpgradeConfig[] {
  return Object.values(OFFICE_UPGRADES)
}

/**
 * Get upgrade config by ID
 */
export function getUpgradeConfig(id: OfficeUpgradeId): OfficeUpgradeConfig {
  return OFFICE_UPGRADES[id]
}

/**
 * Get all upgrades in a specific category
 */
export function getUpgradesByCategory(
  category: 'energy' | 'quality' | 'comfort'
): OfficeUpgradeConfig[] {
  return getAllUpgrades().filter((u) => u.category === category)
}

/**
 * Get all upgrades in a specific line
 */
export function getUpgradesByLine(line: string): OfficeUpgradeConfig[] {
  return getAllUpgrades()
    .filter((u) => u.line === line)
    .sort((a, b) => a.tier - b.tier)
}

/**
 * Get unique upgrade lines
 */
export function getUpgradeLines(): string[] {
  const lines = new Set(getAllUpgrades().map((u) => u.line))
  return Array.from(lines)
}
