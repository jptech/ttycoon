import type { Building, Session, SessionDuration } from '@/core/types'
import { OfficeManager } from '@/core/office'

export type SessionTypeAvailability =
  | { canBook: true }
  | { canBook: false; reason: string }

/**
 * Validates whether a session can be booked with the requested session type.
 *
 * Notes:
 * - Virtual sessions require telehealth to be unlocked.
 * - In-office sessions require sufficient room capacity for every occupied hour slot.
 */
export function canBookSessionType(params: {
  building: Building
  sessions: Session[]
  telehealthUnlocked: boolean
  isVirtual: boolean
  day: number
  hour: number
  durationMinutes: SessionDuration
}): SessionTypeAvailability {
  const { building, sessions, telehealthUnlocked, isVirtual, day, hour, durationMinutes } = params

  if (isVirtual) {
    if (!telehealthUnlocked) {
      return { canBook: false, reason: 'Telehealth is not unlocked' }
    }
    return { canBook: true }
  }

  const roomCheck = OfficeManager.canBookInPersonSession(
    building,
    sessions,
    day,
    hour,
    durationMinutes
  )

  if (!roomCheck.canBook) {
    return { canBook: false, reason: roomCheck.reason || 'No rooms available' }
  }

  return { canBook: true }
}
