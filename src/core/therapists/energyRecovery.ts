import type { Therapist } from '@/core/types'
import { THERAPIST_CONFIG } from './TherapistManager'

export interface IdleRecoveryResult {
  updatedTherapist: Therapist
  energyRecovered: number
  /** Remaining fractional recovery in 1/60-energy units */
  remainderUnits: number
}

/**
 * Apply integer-based idle energy recovery for a number of idle minutes.
 *
 * - Uses a floating per-minute rate derived from ENERGY_RECOVERY_PER_HOUR.
 * - Carries fractional recovery forward via `remainder`.
 * - Never "banks" recovery while capped at max energy (remainder is cleared when capped).
 * - Optional multiplier from office upgrades (1.0 = no change)
 */
export function applyIdleEnergyRecovery(
  therapist: Therapist,
  idleMinutes: number,
  remainderUnits: number = 0,
  multiplier: number = 1.0
): IdleRecoveryResult {
  if (idleMinutes <= 0) {
    return { updatedTherapist: therapist, energyRecovered: 0, remainderUnits }
  }

  if (therapist.energy >= therapist.maxEnergy) {
    return { updatedTherapist: therapist, energyRecovered: 0, remainderUnits: 0 }
  }

  const energyPerHour = THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR * multiplier
  const totalUnits = idleMinutes * energyPerHour + remainderUnits
  const recoveredInteger = Math.floor(totalUnits / 60)
  const nextRemainderUnits = totalUnits % 60

  if (recoveredInteger <= 0) {
    return {
      updatedTherapist: therapist,
      energyRecovered: 0,
      remainderUnits: nextRemainderUnits,
    }
  }

  const newEnergy = Math.min(therapist.maxEnergy, therapist.energy + recoveredInteger)
  const actualRecovered = newEnergy - therapist.energy

  // If we're capped, drop any remainder to avoid banking recovery.
  const finalRemainderUnits = newEnergy >= therapist.maxEnergy ? 0 : nextRemainderUnits

  return {
    updatedTherapist: { ...therapist, energy: newEnergy },
    energyRecovered: actualRecovered,
    remainderUnits: finalRemainderUnits,
  }
}
