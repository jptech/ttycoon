import type {
  Schedule,
  Session,
  SessionDuration,
  SessionType,
  Client,
  Therapist,
  DayAvailability,
  GameTime,
} from '@/core/types'
import { TIME_CONFIG } from '@/core/engine'
import { TherapistManager } from '@/core/therapists'

/**
 * Configuration for schedule management
 */
export const SCHEDULE_CONFIG = {
  /** Default session duration in minutes */
  DEFAULT_DURATION: 50 as SessionDuration,
  /** Buffer time between sessions in minutes */
  BUFFER_TIME: 10,
  /** Maximum sessions per day per therapist */
  MAX_SESSIONS_PER_DAY: 8,
  /** Business hours */
  BUSINESS_START: TIME_CONFIG.BUSINESS_START,
  BUSINESS_END: TIME_CONFIG.BUSINESS_END,
} as const

/**
 * Available time slot for scheduling
 */
export interface AvailableSlot {
  day: number
  hour: number
  therapistId: string
  isPreferred: boolean // Matches client preference
}

/**
 * Session creation parameters
 */
export interface CreateSessionParams {
  therapistId: string
  clientId: string
  day: number
  hour: number
  duration?: SessionDuration
  sessionType?: SessionType
  isVirtual?: boolean
}

/**
 * Schedule conflict info
 */
export interface ScheduleConflict {
  day: number
  hour: number
  therapistId: string
  existingSessionId: string
  reason: string
}

export interface ScheduleTimeValidation {
  valid: boolean
  reason?: string
}

/**
 * Pure schedule management functions
 */
export const ScheduleManager = {
  /**
   * Validate that a proposed session time is not in the past relative to the current game time.
   * Sessions start at the top of the hour, so scheduling for the current hour is only valid
   * if the current minute is 0.
   */
  validateNotInPast(currentTime: GameTime, day: number, hour: number): ScheduleTimeValidation {
    if (day < currentTime.day) {
      return { valid: false, reason: 'Cannot schedule for a previous day' }
    }

    if (day === currentTime.day) {
      if (hour < currentTime.hour) {
        return { valid: false, reason: 'Cannot schedule for a past hour' }
      }

      if (hour === currentTime.hour && currentTime.minute > 0) {
        return { valid: false, reason: 'Cannot schedule for an hour already in progress' }
      }
    }

    return { valid: true }
  },

  /**
   * Rebuild a schedule map from the sessions list.
   * Ensures every scheduled/in-progress/completed session has its occupied slots represented.
   * (Cancelled/conflict sessions do not occupy slots.)
   */
  buildScheduleFromSessions(sessions: Session[]): Schedule {
    return sessions
      .filter((s) => s.status === 'scheduled' || s.status === 'in_progress' || s.status === 'completed')
      .reduce<Schedule>((schedule, session) => {
        return this.addToSchedule(schedule, session)
      }, {})
  },

  /**
   * Check if a time slot is available for a therapist
   * @param therapist Optional therapist object to check against custom work hours
   */
  isSlotAvailable(
    schedule: Schedule,
    therapistId: string,
    day: number,
    hour: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION,
    therapist?: Therapist
  ): boolean {
    // Calculate how many hour slots this session needs
    const slotsNeeded = Math.ceil(duration / 60)

    // Check each slot
    for (let i = 0; i < slotsNeeded; i++) {
      const checkHour = hour + i

      // If therapist is provided, use their custom work hours
      if (therapist) {
        if (!TherapistManager.isWithinWorkHours(therapist, checkHour)) {
          return false // Outside therapist's work hours or on lunch break
        }
      } else {
        // Fall back to global business hours if no therapist provided
        if (checkHour < SCHEDULE_CONFIG.BUSINESS_START || checkHour >= SCHEDULE_CONFIG.BUSINESS_END) {
          return false
        }
      }

      const daySchedule = schedule[day]
      if (daySchedule) {
        const hourSchedule = daySchedule[checkHour]
        if (hourSchedule && hourSchedule[therapistId]) {
          return false // Slot is occupied
        }
      }
    }

    return true
  },

  /**
   * Get all available slots for a therapist on a given day
   * @param therapist Optional therapist object to check against custom work hours
   */
  getAvailableSlotsForDay(
    schedule: Schedule,
    therapistId: string,
    day: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION,
    therapist?: Therapist
  ): number[] {
    const availableHours: number[] = []

    // Use therapist's work hours if provided, otherwise use global business hours
    const startHour = therapist
      ? TherapistManager.getWorkSchedule(therapist).workStartHour
      : SCHEDULE_CONFIG.BUSINESS_START
    const endHour = therapist
      ? TherapistManager.getWorkSchedule(therapist).workEndHour
      : SCHEDULE_CONFIG.BUSINESS_END

    for (let hour = startHour; hour < endHour; hour++) {
      if (this.isSlotAvailable(schedule, therapistId, day, hour, duration, therapist)) {
        availableHours.push(hour)
      }
    }

    return availableHours
  },

  /**
   * Find available slots that match client preferences
   * Respects therapist's custom work hours
   */
  findMatchingSlots(
    schedule: Schedule,
    therapist: Therapist,
    client: Client,
    startDay: number,
    daysToCheck: number = 14,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION
  ): AvailableSlot[] {
    const slots: AvailableSlot[] = []

    // Get therapist's work hours
    const workSchedule = TherapistManager.getWorkSchedule(therapist)
    const startHour = workSchedule.workStartHour
    const endHour = workSchedule.workEndHour

    for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
      const day = startDay + dayOffset
      const dayOfWeek = this.getDayOfWeek(day)
      const clientAvailability = this.getClientAvailabilityForDay(client.availability, dayOfWeek)

      for (let hour = startHour; hour < endHour; hour++) {
        if (this.isSlotAvailable(schedule, therapist.id, day, hour, duration, therapist)) {
          const isPreferred =
            clientAvailability.includes(hour) &&
            this.matchesTimePreference(hour, client.preferredTime)

          slots.push({
            day,
            hour,
            therapistId: therapist.id,
            isPreferred,
          })
        }
      }
    }

    // Sort by preference (preferred first), then by day
    return slots.sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) {
        return a.isPreferred ? -1 : 1
      }
      if (a.day !== b.day) {
        return a.day - b.day
      }
      return a.hour - b.hour
    })
  },

  /**
   * Get day of week from game day (1 = Monday, 5 = Friday, then repeats)
   */
  getDayOfWeek(day: number): keyof DayAvailability {
    const days: (keyof DayAvailability)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    return days[(day - 1) % 5]
  },

  /**
   * Get client availability hours for a specific day of week
   */
  getClientAvailabilityForDay(availability: DayAvailability, day: keyof DayAvailability): number[] {
    return availability[day] || []
  },

  /**
   * Check if hour matches client's time preference
   */
  matchesTimePreference(hour: number, preference: Client['preferredTime']): boolean {
    switch (preference) {
      case 'morning':
        return hour >= 8 && hour < 12
      case 'afternoon':
        return hour >= 12 && hour < 16
      case 'evening':
        return hour >= 16 && hour < 18
      case 'any':
        return true
      default:
        return true
    }
  },

  /**
   * Create a new session
   */
  createSession(
    params: CreateSessionParams,
    therapist: Therapist,
    client: Client
  ): Session {
    const {
      therapistId,
      clientId,
      day,
      hour,
      duration = SCHEDULE_CONFIG.DEFAULT_DURATION,
      sessionType = 'clinical',
      isVirtual = client.prefersVirtual,
    } = params

    // CRIT-005 fix: Apply duration multiplier at session creation time
    const payment = this.calculateSessionPayment(client.sessionRate, duration)

    return {
      id: crypto.randomUUID(),
      therapistId,
      clientId,
      sessionType,
      isVirtual,
      isInsurance: !client.isPrivatePay,
      scheduledDay: day,
      scheduledHour: hour,
      durationMinutes: duration,
      status: 'scheduled',
      progress: 0,
      quality: 0.5, // Base quality, will be modified during session
      qualityModifiers: [],
      payment,
      energyCost: this.calculateEnergyCost(duration, therapist.level),
      xpGained: 0,
      decisionsMade: [],
      therapistName: therapist.displayName,
      clientName: client.displayName,
    }
  },

  /**
   * Calculate session payment with duration multiplier
   * CRIT-005 fix: Consistent with EconomyManager.calculateSessionPayment()
   */
  calculateSessionPayment(baseRate: number, duration: SessionDuration): number {
    const EXTENDED_SESSION_MULTIPLIER = 1.5  // 80-minute sessions
    const INTENSIVE_SESSION_MULTIPLIER = 3   // 180-minute sessions

    let payment = baseRate
    if (duration === 80) {
      payment *= EXTENDED_SESSION_MULTIPLIER
    } else if (duration === 180) {
      payment *= INTENSIVE_SESSION_MULTIPLIER
    }
    return Math.round(payment)
  },

  /**
   * Calculate energy cost for a session
   * HIGH-007 fix: Cap level at 50 (MAX_LEVEL) to prevent edge cases
   */
  calculateEnergyCost(duration: SessionDuration, therapistLevel: number): number {
    const baseCost = {
      50: 15,
      80: 25,
      180: 50,
    }[duration]

    // HIGH-007 fix: Cap level at MAX_LEVEL (50) to prevent edge cases
    const cappedLevel = Math.min(therapistLevel, 50)

    // Higher level therapists are more efficient
    const levelModifier = Math.max(0.5, 1 - cappedLevel * 0.01)
    return Math.round(baseCost * levelModifier)
  },

  /**
   * Add a session to the schedule
   */
  addToSchedule(
    schedule: Schedule,
    session: Session
  ): Schedule {
    const newSchedule: Schedule = { ...schedule }
    const slotsNeeded = Math.ceil(session.durationMinutes / 60)

    // IMPORTANT: Zustand+Immer may freeze nested objects.
    // Clone at each level we mutate (day/hour) to avoid mutating frozen state.
    const existingDaySchedule = newSchedule[session.scheduledDay]
    const daySchedule = existingDaySchedule ? { ...existingDaySchedule } : {}
    newSchedule[session.scheduledDay] = daySchedule

    for (let i = 0; i < slotsNeeded; i++) {
      const hour = session.scheduledHour + i

      const existingHourSchedule = daySchedule[hour]
      const hourSchedule = existingHourSchedule ? { ...existingHourSchedule } : {}
      daySchedule[hour] = hourSchedule
      hourSchedule[session.therapistId] = session.id
    }

    return newSchedule
  },

  /**
   * Remove a session from the schedule
   */
  removeFromSchedule(
    schedule: Schedule,
    session: Session
  ): Schedule {
    const newSchedule: Schedule = { ...schedule }
    const slotsNeeded = Math.ceil(session.durationMinutes / 60)

    const existingDaySchedule = newSchedule[session.scheduledDay]
    if (!existingDaySchedule) {
      return newSchedule
    }

    const daySchedule = { ...existingDaySchedule }
    newSchedule[session.scheduledDay] = daySchedule

    for (let i = 0; i < slotsNeeded; i++) {
      const hour = session.scheduledHour + i

      const existingHourSchedule = daySchedule[hour]
      if (!existingHourSchedule) continue

      const hourSchedule = { ...existingHourSchedule }
      delete hourSchedule[session.therapistId]

      // Preserve structure (day/hour keys) for stability across callers/tests.
      daySchedule[hour] = hourSchedule
    }

    return newSchedule
  },

  /**
   * Get all sessions for a specific day
   */
  getSessionsForDay(
    schedule: Schedule,
    sessions: Session[],
    day: number
  ): Session[] {
    const sessionIds = new Set<string>()
    const daySchedule = schedule[day]

    if (daySchedule) {
      for (const hourSlots of Object.values(daySchedule)) {
        for (const sessionId of Object.values(hourSlots)) {
          if (sessionId) {
            sessionIds.add(sessionId)
          }
        }
      }
    }

    return sessions.filter((s) => sessionIds.has(s.id))
  },

  /**
   * Get sessions for a therapist on a specific day
   */
  getTherapistSessionsForDay(
    schedule: Schedule,
    sessions: Session[],
    therapistId: string,
    day: number
  ): Session[] {
    const sessionIds = new Set<string>()
    const daySchedule = schedule[day]

    if (daySchedule) {
      for (const hourSlots of Object.values(daySchedule)) {
        const sessionId = hourSlots[therapistId]
        if (sessionId) {
          sessionIds.add(sessionId)
        }
      }
    }

    return sessions.filter((s) => sessionIds.has(s.id))
  },

  /**
   * Count sessions for a therapist on a day
   */
  countSessionsForDay(
    schedule: Schedule,
    sessions: Session[],
    therapistId: string,
    day: number
  ): number {
    return this.getTherapistSessionsForDay(schedule, sessions, therapistId, day).length
  },

  /**
   * Check if therapist has room for more sessions today
   */
  canScheduleMoreToday(
    schedule: Schedule,
    sessions: Session[],
    therapistId: string,
    day: number
  ): boolean {
    return this.countSessionsForDay(schedule, sessions, therapistId, day) < SCHEDULE_CONFIG.MAX_SESSIONS_PER_DAY
  },

  /**
   * Get schedule conflicts for a proposed session
   */
  getConflicts(
    schedule: Schedule,
    therapistId: string,
    day: number,
    hour: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION
  ): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = []
    const slotsNeeded = Math.ceil(duration / 60)

    for (let i = 0; i < slotsNeeded; i++) {
      const checkHour = hour + i
      const daySchedule = schedule[day]

      if (daySchedule) {
        const hourSchedule = daySchedule[checkHour]
        if (hourSchedule) {
          const existingSessionId = hourSchedule[therapistId]
          if (existingSessionId) {
            conflicts.push({
              day,
              hour: checkHour,
              therapistId,
              existingSessionId,
              reason: `Slot already booked at ${checkHour}:00`,
            })
          }
        }
      }
    }

    return conflicts
  },

  /**
   * Check whether the client already has an overlapping scheduled/in-progress session.
   * Uses hour-slot overlap semantics (multi-hour sessions occupy multiple hour slots).
   */
  clientHasConflictingSession(
    sessions: Session[],
    clientId: string,
    day: number,
    hour: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION
  ): boolean {
    const proposedStart = hour
    const proposedEnd = hour + Math.ceil(duration / 60)

    return sessions.some((s) => {
      if (s.clientId !== clientId) return false
      if (s.scheduledDay !== day) return false
      if (s.status !== 'scheduled' && s.status !== 'in_progress') return false

      const sStart = s.scheduledHour
      const sEnd = s.scheduledHour + Math.ceil(s.durationMinutes / 60)
      return proposedStart < sEnd && sStart < proposedEnd
    })
  },

  /**
   * Get next scheduled session for a therapist
   */
  getNextSession(
    sessions: Session[],
    therapistId: string,
    currentTime: GameTime
  ): Session | null {
    const upcomingSessions = sessions
      .filter(
        (s) =>
          s.therapistId === therapistId &&
          s.status === 'scheduled' &&
          (s.scheduledDay > currentTime.day ||
            (s.scheduledDay === currentTime.day && s.scheduledHour > currentTime.hour))
      )
      .sort((a, b) => {
        if (a.scheduledDay !== b.scheduledDay) {
          return a.scheduledDay - b.scheduledDay
        }
        return a.scheduledHour - b.scheduledHour
      })

    return upcomingSessions[0] || null
  },

  /**
   * Format hour for display (e.g., "9:00 AM")
   */
  formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:00 ${ampm}`
  },

  /**
   * Get time range string for a session
   */
  getSessionTimeRange(session: Session): string {
    const startHour = session.scheduledHour
    const endMinutes = startHour * 60 + session.durationMinutes
    const endHour = Math.floor(endMinutes / 60)
    const endMin = endMinutes % 60

    const formatTime = (h: number, m: number = 0): string => {
      const ampm = h >= 12 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      return m === 0 ? `${displayH}:00 ${ampm}` : `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
    }

    return `${formatTime(startHour)} - ${formatTime(endHour, endMin)}`
  },
}

