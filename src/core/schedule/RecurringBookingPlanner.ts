import type { Building, Client, Schedule, Session, SessionDuration, Therapist } from '@/core/types'
import { ScheduleManager } from './ScheduleManager'
import { canBookSessionType } from './BookingConstraints'

export interface PlannedRecurringSlot {
  day: number
  hour: number
}

export interface RecurringBookingFailure {
  /** 0-based index within the requested series */
  index: number
  /** Desired day for this occurrence */
  targetDay: number
  /** Preferred start hour (usually from the initial selection) */
  preferredHour: number
  reason: string
}

export interface PlanRecurringBookingsParams {
  schedule: Schedule
  sessions: Session[]
  therapist: Therapist
  client: Client
  building: Building
  telehealthUnlocked: boolean

  currentTime: { day: number; hour: number; minute: number }

  startDay: number
  startHour: number
  durationMinutes: SessionDuration
  isVirtual: boolean

  /** Number of sessions to plan, including the first one */
  count: number
  /** Days between sessions (e.g., 7 weekly, 14 biweekly) */
  intervalDays: number
}

export interface PlanRecurringBookingsResult {
  planned: PlannedRecurringSlot[]
  failures: RecurringBookingFailure[]
}

function createPlanningSessionStub(params: {
  id: string
  therapistId: string
  clientId: string
  day: number
  hour: number
  durationMinutes: SessionDuration
  isVirtual: boolean
}): Session {
  return {
    id: params.id,
    therapistId: params.therapistId,
    clientId: params.clientId,
    sessionType: 'clinical',
    isVirtual: params.isVirtual,
    isInsurance: false,
    scheduledDay: params.day,
    scheduledHour: params.hour,
    durationMinutes: params.durationMinutes,
    status: 'scheduled',
    progress: 0,
    quality: 0.5,
    qualityModifiers: [],
    payment: 0,
    energyCost: 0,
    xpGained: 0,
    decisionsMade: [],
    therapistName: '',
    clientName: '',
  }
}

function pickClosestHour(options: number[], preferredHour: number): number {
  return [...options].sort((a, b) => {
    const da = Math.abs(a - preferredHour)
    const db = Math.abs(b - preferredHour)
    if (da !== db) return da - db
    return a - b
  })[0]!
}

/**
 * Plans a series of recurring sessions starting from the given (day, hour).
 *
 * Policy:
 * - Occurrence 0 must book exactly at (startDay, startHour).
 * - Subsequent occurrences target `startDay + index * intervalDays`.
 * - If the exact hour isn't available for a target day, the planner will pick the closest available hour
 *   on that same day that satisfies therapist availability, client conflicts, room/telehealth constraints,
 *   and not-in-past validation.
 */
export function planRecurringBookings(params: PlanRecurringBookingsParams): PlanRecurringBookingsResult {
  const {
    schedule,
    sessions,
    therapist,
    client,
    building,
    telehealthUnlocked,
    currentTime,
    startDay,
    startHour,
    durationMinutes,
    isVirtual,
    count,
    intervalDays,
  } = params

  if (!Number.isFinite(count) || count <= 0) {
    return {
      planned: [],
      failures: [
        {
          index: 0,
          targetDay: startDay,
          preferredHour: startHour,
          reason: 'Count must be at least 1',
        },
      ],
    }
  }

  if (!Number.isFinite(intervalDays) || intervalDays < 0) {
    return {
      planned: [],
      failures: [
        {
          index: 0,
          targetDay: startDay,
          preferredHour: startHour,
          reason: 'Interval must be 0 or greater',
        },
      ],
    }
  }

  let workingSchedule = schedule
  let workingSessions = sessions

  const planned: PlannedRecurringSlot[] = []
  const failures: RecurringBookingFailure[] = []

  for (let i = 0; i < count; i++) {
    const targetDay = startDay + i * intervalDays
    const preferredHour = startHour

    const candidateHours = ScheduleManager.findMatchingSlots(
      workingSchedule,
      therapist,
      client,
      targetDay,
      1,
      durationMinutes
    )
      .filter((s) => s.day === targetDay)
      .map((s) => s.hour)

    const uniqueCandidateHours = Array.from(new Set(candidateHours))

    if (uniqueCandidateHours.length === 0) {
      failures.push({
        index: i,
        targetDay,
        preferredHour,
        reason: 'No therapist-available slots on this day',
      })
      continue
    }

    let orderedCandidateHours: number[] = []

    if (i === 0) {
      // Occurrence 0 must use the exact selected hour.
      orderedCandidateHours = uniqueCandidateHours.includes(preferredHour) ? [preferredHour] : []
    } else if (uniqueCandidateHours.includes(preferredHour)) {
      orderedCandidateHours = [preferredHour, ...uniqueCandidateHours.filter((h) => h !== preferredHour)]
    } else {
      const closest = pickClosestHour(uniqueCandidateHours, preferredHour)
      orderedCandidateHours = [closest, ...uniqueCandidateHours.filter((h) => h !== closest)]
    }

    let booked = false
    let lastReason = 'No valid slot found'

    for (const hour of orderedCandidateHours) {
      const timeCheck = ScheduleManager.validateNotInPast(currentTime, targetDay, hour)
      if (!timeCheck.valid) {
        lastReason = timeCheck.reason || 'Cannot schedule in the past'
        continue
      }

      if (!ScheduleManager.isSlotAvailable(workingSchedule, therapist.id, targetDay, hour, durationMinutes)) {
        lastReason = 'Therapist slot is not available'
        continue
      }

      if (ScheduleManager.clientHasConflictingSession(workingSessions, client.id, targetDay, hour, durationMinutes)) {
        lastReason = 'Client has a conflicting session'
        continue
      }

      if (!ScheduleManager.canScheduleMoreToday(workingSchedule, workingSessions, therapist.id, targetDay)) {
        lastReason = 'Therapist has reached daily session limit'
        continue
      }

      const typeCheck = canBookSessionType({
        building,
        sessions: workingSessions,
        telehealthUnlocked,
        isVirtual,
        day: targetDay,
        hour,
        durationMinutes,
      })

      if (!typeCheck.canBook) {
        lastReason = typeCheck.reason
        continue
      }

      // Reserve the slot in working state.
      const stub = createPlanningSessionStub({
        id: `planned-${client.id}-${therapist.id}-${targetDay}-${hour}-${i}`,
        therapistId: therapist.id,
        clientId: client.id,
        day: targetDay,
        hour,
        durationMinutes,
        isVirtual,
      })

      workingSessions = [...workingSessions, stub]
      workingSchedule = ScheduleManager.addToSchedule(workingSchedule, stub)
      planned.push({ day: targetDay, hour })
      booked = true
      break
    }

    if (!booked) {
      failures.push({ index: i, targetDay, preferredHour, reason: lastReason })
    }
  }

  return { planned, failures }
}
