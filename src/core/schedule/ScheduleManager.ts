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

/**
 * Pure schedule management functions
 */
export const ScheduleManager = {
  /**
   * Check if a time slot is available for a therapist
   */
  isSlotAvailable(
    schedule: Schedule,
    therapistId: string,
    day: number,
    hour: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION
  ): boolean {
    // Check if within business hours
    if (hour < SCHEDULE_CONFIG.BUSINESS_START || hour >= SCHEDULE_CONFIG.BUSINESS_END) {
      return false
    }

    // Calculate how many hour slots this session needs
    const slotsNeeded = Math.ceil(duration / 60)

    // Check each slot
    for (let i = 0; i < slotsNeeded; i++) {
      const checkHour = hour + i
      if (checkHour >= SCHEDULE_CONFIG.BUSINESS_END) {
        return false // Session would extend past business hours
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
   */
  getAvailableSlotsForDay(
    schedule: Schedule,
    therapistId: string,
    day: number,
    duration: SessionDuration = SCHEDULE_CONFIG.DEFAULT_DURATION
  ): number[] {
    const availableHours: number[] = []

    for (let hour = SCHEDULE_CONFIG.BUSINESS_START; hour < SCHEDULE_CONFIG.BUSINESS_END; hour++) {
      if (this.isSlotAvailable(schedule, therapistId, day, hour, duration)) {
        availableHours.push(hour)
      }
    }

    return availableHours
  },

  /**
   * Find available slots that match client preferences
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

    for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
      const day = startDay + dayOffset
      const dayOfWeek = this.getDayOfWeek(day)
      const clientAvailability = this.getClientAvailabilityForDay(client.availability, dayOfWeek)

      for (let hour = SCHEDULE_CONFIG.BUSINESS_START; hour < SCHEDULE_CONFIG.BUSINESS_END; hour++) {
        if (this.isSlotAvailable(schedule, therapist.id, day, hour, duration)) {
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
      payment: client.sessionRate,
      energyCost: this.calculateEnergyCost(duration, therapist.level),
      xpGained: 0,
      decisionsMade: [],
      therapistName: therapist.displayName,
      clientName: client.displayName,
    }
  },

  /**
   * Calculate energy cost for a session
   */
  calculateEnergyCost(duration: SessionDuration, therapistLevel: number): number {
    const baseCost = {
      50: 15,
      80: 25,
      180: 50,
    }[duration]

    // Higher level therapists are more efficient
    const levelModifier = Math.max(0.5, 1 - therapistLevel * 0.01)
    return Math.round(baseCost * levelModifier)
  },

  /**
   * Add a session to the schedule
   */
  addToSchedule(
    schedule: Schedule,
    session: Session
  ): Schedule {
    const newSchedule = { ...schedule }
    const slotsNeeded = Math.ceil(session.durationMinutes / 60)

    for (let i = 0; i < slotsNeeded; i++) {
      const hour = session.scheduledHour + i

      if (!newSchedule[session.scheduledDay]) {
        newSchedule[session.scheduledDay] = {}
      }
      if (!newSchedule[session.scheduledDay][hour]) {
        newSchedule[session.scheduledDay][hour] = {}
      }
      newSchedule[session.scheduledDay][hour][session.therapistId] = session.id
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
    const newSchedule = { ...schedule }
    const slotsNeeded = Math.ceil(session.durationMinutes / 60)

    for (let i = 0; i < slotsNeeded; i++) {
      const hour = session.scheduledHour + i

      if (
        newSchedule[session.scheduledDay] &&
        newSchedule[session.scheduledDay][hour]
      ) {
        delete newSchedule[session.scheduledDay][hour][session.therapistId]
      }
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
