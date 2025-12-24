import type { Building } from '@/core/types'

/**
 * Available office buildings
 */
export const BUILDINGS: Record<string, Building> = {
  starter_suite: {
    id: 'starter_suite',
    name: 'Starter Suite',
    tier: 1,
    rooms: 1,
    monthlyRent: 1500,
    upgradeCost: 0, // Starting building
    requiredLevel: 1,
  },
  small_office: {
    id: 'small_office',
    name: 'Small Office',
    tier: 1,
    rooms: 2,
    monthlyRent: 2500,
    upgradeCost: 5000,
    requiredLevel: 2,
  },
  professional_suite: {
    id: 'professional_suite',
    name: 'Professional Suite',
    tier: 2,
    rooms: 3,
    monthlyRent: 4000,
    upgradeCost: 15000,
    requiredLevel: 3,
  },
  medical_building: {
    id: 'medical_building',
    name: 'Medical Building Office',
    tier: 2,
    rooms: 4,
    monthlyRent: 6000,
    upgradeCost: 30000,
    requiredLevel: 4,
  },
  premium_clinic: {
    id: 'premium_clinic',
    name: 'Premium Clinic',
    tier: 3,
    rooms: 6,
    monthlyRent: 10000,
    upgradeCost: 75000,
    requiredLevel: 5,
  },
}

/**
 * Get building by ID
 */
export function getBuilding(id: string): Building | undefined {
  return BUILDINGS[id]
}

/**
 * Get buildings sorted by tier and rent
 */
export function getBuildingsSorted(): Building[] {
  return Object.values(BUILDINGS).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    return a.monthlyRent - b.monthlyRent
  })
}

/**
 * Get available upgrades for current building
 */
export function getAvailableUpgrades(
  currentBuildingId: string,
  practiceLevel: number
): Building[] {
  const currentBuilding = BUILDINGS[currentBuildingId]
  if (!currentBuilding) return []

  return Object.values(BUILDINGS).filter(
    (b) =>
      b.tier >= currentBuilding.tier &&
      b.id !== currentBuildingId &&
      b.requiredLevel <= practiceLevel
  )
}

/**
 * Get monthly rent for a building
 */
export function getBuildingRent(buildingId: string): number {
  return BUILDINGS[buildingId]?.monthlyRent ?? 0
}

/**
 * Calculate daily rent from monthly
 */
export function getDailyRent(buildingId: string): number {
  const monthlyRent = getBuildingRent(buildingId)
  return Math.round(monthlyRent / 30)
}
