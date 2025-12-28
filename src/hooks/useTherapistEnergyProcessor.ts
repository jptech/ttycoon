import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '@/store'
import { EventBus, GameEvents } from '@/core/events'
import { TherapistManager, applyIdleEnergyRecovery } from '@/core/therapists'
import { OfficeUpgradeManager } from '@/core/office'
import { TIME_CONFIG, type TimeAdvanceResult } from '@/core/engine'
import type { GameTime } from '@/core/types'

interface UseTherapistEnergyProcessorOptions {
  enabled?: boolean
  /** Hours of overnight rest applied on DAY_ENDED */
  overnightRestHours?: number
}

function businessMinutesBetween(from: GameTime, to: GameTime): number {
  if (to.day < from.day) return 0

  // Same day: straightforward diff
  if (to.day === from.day) {
    return Math.max(0, (to.hour - from.hour) * 60 + (to.minute - from.minute))
  }

  const minutesPerBusinessDay = (TIME_CONFIG.BUSINESS_END - TIME_CONFIG.BUSINESS_START) * 60

  const remainingFromDay = Math.max(
    0,
    (TIME_CONFIG.BUSINESS_END - from.hour) * 60 - from.minute
  )

  const fullDaysBetween = Math.max(0, to.day - from.day - 1)
  const betweenDaysMinutes = fullDaysBetween * minutesPerBusinessDay

  const minutesIntoToDay = Math.max(0, (to.hour - TIME_CONFIG.BUSINESS_START) * 60 + to.minute)

  return remainingFromDay + betweenDaysMinutes + minutesIntoToDay
}

/**
 * Tracks therapist energy recovery over time.
 *
 * - Energy is *recovered* only for idle minutes (not in-session minutes).
 * - A large recharge is applied on day boundaries.
 * - Uses integer energy with fractional carry-over stored in refs.
 */
export function useTherapistEnergyProcessor(options: UseTherapistEnergyProcessorOptions = {}) {
  const { enabled = true, overnightRestHours = 16 } = options

  const sessionMinutesByTherapistRef = useRef<Map<string, number>>(new Map())
  const remainderUnitsByTherapistRef = useRef<Map<string, number>>(new Map())

  const recordSessionMinutes = useCallback((therapistId: string, minutes: number) => {
    if (minutes <= 0) return
    const map = sessionMinutesByTherapistRef.current
    map.set(therapistId, (map.get(therapistId) ?? 0) + minutes)
  }, [])

  const onTimeAdvance = useCallback((result: TimeAdvanceResult) => {
    if (!enabled) return

    const deltaMinutes = businessMinutesBetween(result.previousTime, result.newTime)
    if (deltaMinutes <= 0) {
      sessionMinutesByTherapistRef.current.clear()
      return
    }

    const state = useGameStore.getState()
    const { therapists, buildingUpgrades } = state
    const { updateTherapist } = state

    // Get upgrade effects for energy recovery multipliers
    const upgradeEffects = OfficeUpgradeManager.getAggregatedEffects(buildingUpgrades)

    for (const therapist of therapists) {
      if (therapist.status === 'in_session') continue
      if (therapist.status === 'burned_out') continue

      const sessionMinutes = sessionMinutesByTherapistRef.current.get(therapist.id) ?? 0
      const idleMinutes = Math.max(0, deltaMinutes - sessionMinutes)
      if (idleMinutes <= 0) continue

      // Use break multiplier if on break, otherwise use idle multiplier
      const multiplier = therapist.status === 'on_break'
        ? upgradeEffects.breakEnergyRecoveryMultiplier
        : upgradeEffects.idleEnergyRecoveryMultiplier

      const remainderUnits = remainderUnitsByTherapistRef.current.get(therapist.id) ?? 0
      const recovery = applyIdleEnergyRecovery(therapist, idleMinutes, remainderUnits, multiplier)
      remainderUnitsByTherapistRef.current.set(therapist.id, recovery.remainderUnits)

      if (recovery.updatedTherapist.energy !== therapist.energy) {
        updateTherapist(therapist.id, { energy: recovery.updatedTherapist.energy })
      }
    }

    sessionMinutesByTherapistRef.current.clear()
  }, [enabled])

  // End-of-day: big recharge + burnout recovery (once per day)
  useEffect(() => {
    if (!enabled) return

    const handleDayEnded = () => {
      const state = useGameStore.getState()
      const { therapists, updateTherapist } = state

      for (const therapist of therapists) {
        const rest = TherapistManager.processRest(therapist, overnightRestHours)
        const updated = rest.updatedTherapist

        updateTherapist(therapist.id, {
          energy: updated.energy,
          status: updated.status,
          burnoutRecoveryProgress: updated.burnoutRecoveryProgress,
        })

        remainderUnitsByTherapistRef.current.set(therapist.id, 0)
      }
    }

    return EventBus.on(GameEvents.DAY_ENDED, handleDayEnded)
  }, [enabled, overnightRestHours])

  // Start-of-day: ensure working therapists begin well-rested.
  useEffect(() => {
    if (!enabled) return

    const handleDayStarted = () => {
      const state = useGameStore.getState()
      const { therapists, updateTherapist } = state

      for (const therapist of therapists) {
        if (therapist.status === 'burned_out') continue

        if (therapist.energy !== therapist.maxEnergy) {
          updateTherapist(therapist.id, { energy: therapist.maxEnergy })
        }

        remainderUnitsByTherapistRef.current.set(therapist.id, 0)
      }
    }

    return EventBus.on(GameEvents.DAY_STARTED, handleDayStarted)
  }, [enabled])

  return {
    recordSessionMinutes,
    onTimeAdvance,
  }
}
