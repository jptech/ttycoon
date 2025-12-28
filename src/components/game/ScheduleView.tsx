import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Building, Session, Therapist, Schedule } from '@/core/types'
import { ScheduleManager, SCHEDULE_CONFIG } from '@/core/schedule'
import { TherapistManager } from '@/core/therapists'
import { OfficeManager } from '@/core/office'
import { TimeSlot } from './TimeSlot'
import { SessionCard } from './SessionCard'
import { Card, Button, Badge } from '@/components/ui'
import { ChevronLeft, ChevronRight, Calendar, User, Video, Building as BuildingIcon, CalendarCheck, Coffee } from 'lucide-react'

export interface ScheduleViewProps {
  /** Current game day */
  currentDay: number
  /** Current game hour */
  currentHour: number
  /** Current game minute */
  currentMinute: number
  /** Schedule data */
  schedule: Schedule
  /** All sessions */
  sessions: Session[]
  /** Available therapists */
  therapists: Therapist[]
  /** Current building (room capacity). If omitted, room capacity is not enforced in the UI. */
  currentBuilding?: Building
  /** Whether telehealth is unlocked (affects whether booking is possible when rooms are full). */
  telehealthUnlocked?: boolean
  /** Currently selected therapist ID */
  selectedTherapistId?: string
  /** Callback when therapist is selected */
  onTherapistSelect?: (therapistId: string) => void
  /** Callback when a slot is clicked */
  onSlotClick?: (day: number, hour: number, therapistId: string) => void
  /** Callback when a session is clicked */
  onSessionClick?: (session: Session) => void
  /** View mode */
  view?: 'day' | 'week'
  /** Additional class name */
  className?: string
}

export function ScheduleView(props: ScheduleViewProps) {
  const {
    currentDay,
    currentHour,
    currentMinute,
    schedule,
    sessions,
    therapists,
    currentBuilding,
    telehealthUnlocked = true,
    selectedTherapistId,
    onTherapistSelect,
    onSlotClick,
    onSessionClick,
    className,
  } = props
  // Note: view prop reserved for future week view implementation
  const [viewDay, setViewDay] = useState(currentDay)
  const [viewMode, setViewMode] = useState<'therapist' | 'grid'>(
    therapists.length > 1 ? 'grid' : 'therapist'
  )

  // Auto-advance to current day when the game day changes (e.g., after Day Summary)
  useEffect(() => {
    setViewDay(currentDay)
  }, [currentDay])

  const sessionById = useMemo(() => {
    return new Map(sessions.map((s) => [s.id, s]))
  }, [sessions])

  const roomAvailabilityByHour = useMemo(() => {
    if (!currentBuilding) return new Map<number, ReturnType<typeof OfficeManager.getRoomAvailability>>()
    const map = new Map<number, ReturnType<typeof OfficeManager.getRoomAvailability>>()
    for (let hour = SCHEDULE_CONFIG.BUSINESS_START; hour < SCHEDULE_CONFIG.BUSINESS_END; hour++) {
      map.set(hour, OfficeManager.getRoomAvailability(currentBuilding, sessions, viewDay, hour))
    }
    return map
  }, [currentBuilding, sessions, viewDay])

  // Get the selected therapist (default to first/player)
  const activeTherapist = useMemo(() => {
    if (selectedTherapistId) {
      return therapists.find((t) => t.id === selectedTherapistId)
    }
    return therapists.find((t) => t.isPlayer) || therapists[0]
  }, [therapists, selectedTherapistId])

  const activeTherapistSessions = useMemo(() => {
    if (!activeTherapist) return [] as Session[]
    return ScheduleManager.getTherapistSessionsForDay(schedule, sessions, activeTherapist.id, viewDay)
  }, [schedule, sessions, activeTherapist, viewDay])

  const allDaySessions = useMemo(() => {
    return ScheduleManager.getSessionsForDay(schedule, sessions, viewDay)
  }, [schedule, sessions, viewDay])

  // Compute dynamic time range based on therapist work schedules
  const { timeSlots, therapistWorkHours } = useMemo(() => {
    // Build a map of work hours for each therapist for quick lookup
    const workHoursMap = new Map<string, {
      startHour: number
      endHour: number
      breakHours: number[]
      workHours: number[]
    }>()

    let globalMinStart: number = SCHEDULE_CONFIG.BUSINESS_END
    let globalMaxEnd: number = SCHEDULE_CONFIG.BUSINESS_START

    for (const t of therapists) {
      const schedule = TherapistManager.getWorkSchedule(t)
      const workHours = TherapistManager.getWorkHours(t)
      workHoursMap.set(t.id, {
        startHour: schedule.workStartHour,
        endHour: schedule.workEndHour,
        breakHours: schedule.breakHours,
        workHours,
      })
      globalMinStart = Math.min(globalMinStart, schedule.workStartHour)
      globalMaxEnd = Math.max(globalMaxEnd, schedule.workEndHour)
    }

    // In grid mode: show all hours from earliest start to latest end
    // In therapist mode: show only that therapist's hours
    let startHour: number
    let endHour: number

    if (viewMode === 'grid') {
      startHour = globalMinStart
      endHour = globalMaxEnd
    } else if (activeTherapist) {
      const therapistSchedule = TherapistManager.getWorkSchedule(activeTherapist)
      startHour = therapistSchedule.workStartHour
      endHour = therapistSchedule.workEndHour
    } else {
      startHour = SCHEDULE_CONFIG.BUSINESS_START
      endHour = SCHEDULE_CONFIG.BUSINESS_END
    }

    const slots: number[] = []
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(hour)
    }

    return { timeSlots: slots, therapistWorkHours: workHoursMap }
  }, [therapists, viewMode, activeTherapist])

  // Count virtual vs in-person sessions
  const sessionTypeCounts = useMemo(() => {
    const sessionsArray = viewMode === 'grid' ? allDaySessions : activeTherapistSessions
    const virtual = sessionsArray.filter((s) => s.isVirtual).length
    return { virtual, inPerson: sessionsArray.length - virtual }
  }, [viewMode, allDaySessions, activeTherapistSessions])

  const availableSlotsCount = useMemo(() => {
    const currentTime = { day: currentDay, hour: currentHour, minute: currentMinute }

    if (viewMode === 'grid') {
      let count = 0
      for (const hour of timeSlots) {
        // Skip past slots
        if (!ScheduleManager.validateNotInPast(currentTime, viewDay, hour).valid) continue

        const hourHasAnyBookableCell = therapists.some((t) => {
          const sessionId = schedule[viewDay]?.[hour]?.[t.id]
          if (sessionId) return false

          // Pass therapist to check work hours and lunch breaks
          const therapistFree = ScheduleManager.isSlotAvailable(schedule, t.id, viewDay, hour, 50, t)
          if (!therapistFree) return false

          const roomOk =
            telehealthUnlocked ||
            !currentBuilding ||
            (roomAvailabilityByHour.get(hour)?.roomsAvailable ?? 1) > 0

          return roomOk
        })
        if (hourHasAnyBookableCell) count++
      }
      return count
    }

    if (!activeTherapist) return 0
    const baseSlots = ScheduleManager.getAvailableSlotsForDay(schedule, activeTherapist.id, viewDay)
    // Filter out past slots
    const futureSlots = baseSlots.filter((hour) =>
      ScheduleManager.validateNotInPast(currentTime, viewDay, hour).valid
    )
    if (telehealthUnlocked || !currentBuilding) return futureSlots.length

    return futureSlots.filter((hour) => (roomAvailabilityByHour.get(hour)?.roomsAvailable ?? 1) > 0).length
  }, [
    viewMode,
    timeSlots,
    therapists,
    schedule,
    viewDay,
    currentDay,
    currentHour,
    currentMinute,
    telehealthUnlocked,
    currentBuilding,
    roomAvailabilityByHour,
    activeTherapist,
  ])

  // Navigation handlers
  const goToPreviousDay = () => setViewDay((d) => Math.max(1, d - 1))
  const goToNextDay = () => setViewDay((d) => d + 1)
  const goToToday = () => setViewDay(currentDay)

  if (!activeTherapist) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <p className="text-muted-foreground">No therapists available</p>
      </Card>
    )
  }

  const isViewingToday = viewDay === currentDay
  const isViewingPast = viewDay < currentDay

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Schedule</h2>
          {isViewingPast && (
            <Badge variant="secondary" size="sm">Past</Badge>
          )}
        </div>

        {/* Day navigation */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPreviousDay} disabled={viewDay <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className={cn(
            'min-w-[80px] text-center px-3 py-1.5 rounded-lg text-sm font-medium tabular-nums',
            isViewingToday ? 'bg-primary/15 text-primary' : 'bg-muted'
          )}>
            Day {viewDay}
          </span>

          <Button variant="ghost" size="sm" onClick={goToNextDay}>
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Go to Today button - shown when not viewing today */}
          {!isViewingToday && (
            <Button
              variant="primary"
              size="sm"
              onClick={goToToday}
              className="ml-2"
            >
              <CalendarCheck className="w-4 h-4 mr-1.5" />
              Today
            </Button>
          )}
        </div>
      </div>

      {/* View mode toggle (if multiple therapists) */}
      {therapists.length > 1 && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              All Therapists
            </Button>
            <Button
              variant={viewMode === 'therapist' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('therapist')}
            >
              Single Therapist
            </Button>
          </div>
        </div>
      )}

      {/* Therapist selector (if multiple) */}
      {therapists.length > 1 && (
        viewMode === 'therapist' ? (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          {therapists.map((therapist) => (
            <button
              key={therapist.id}
              onClick={() => onTherapistSelect?.(therapist.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
                therapist.id === activeTherapist.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted-foreground/10'
              )}
            >
              {therapist.displayName}
              {therapist.isPlayer && ' (You)'}
            </button>
          ))}
        </div>
        ) : null
      )}

      {/* Schedule summary */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <div className="flex items-center gap-3">
          <Badge variant="info">{viewMode === 'grid' ? allDaySessions.length : activeTherapistSessions.length} sessions</Badge>
          {(viewMode === 'grid' ? allDaySessions.length : activeTherapistSessions.length) > 0 && (
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Video className="w-3 h-3 text-info" />
                {sessionTypeCounts.virtual}
              </span>
              <span className="flex items-center gap-1">
                <BuildingIcon className="w-3 h-3 text-warning" />
                {sessionTypeCounts.inPerson}
              </span>
            </span>
          )}
          <Badge variant="success">{availableSlotsCount} available</Badge>
          {viewMode === 'therapist' &&
            !ScheduleManager.canScheduleMoreToday(schedule, sessions, activeTherapist.id, viewDay) && (
              <Badge variant="warning">Max sessions reached</Badge>
            )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-info" />
            Virtual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-warning" />
            In-Office
          </span>
          <span className="flex items-center gap-1.5">
            <Coffee className="w-3 h-3 text-warning/70" />
            Break
          </span>
        </div>
      </div>

      {/* Time slots */}
      <Card className="overflow-hidden">
        {viewMode === 'grid' ? (
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `96px repeat(${therapists.length}, minmax(220px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">Time</div>
              {therapists.map((t) => (
                <div
                  key={t.id}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border"
                >
                  {t.displayName}{t.isPlayer ? ' (You)' : ''}
                </div>
              ))}

              {/* Hour rows */}
              {timeSlots.map((hour) => {
                const isCurrentHour = viewDay === currentDay && hour === currentHour
                const roomAvailability = roomAvailabilityByHour.get(hour)
                const roomOk = telehealthUnlocked || !currentBuilding || (roomAvailability?.roomsAvailable ?? 1) > 0
                const isPastSlot = !ScheduleManager.validateNotInPast(
                  { day: currentDay, hour: currentHour, minute: currentMinute },
                  viewDay,
                  hour
                ).valid

                return (
                  <div key={hour} className={cn('contents', isCurrentHour && 'bg-primary/5')}>
                    <div
                      className={cn(
                        'px-3 py-2 text-sm text-muted-foreground border-b border-border',
                        isCurrentHour && 'bg-primary/5',
                        isPastSlot && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{ScheduleManager.formatHour(hour)}</span>
                        {currentBuilding && (
                          <span className="text-[10px] text-muted-foreground/70">
                            Rooms {roomAvailability?.roomsInUse ?? 0}/{roomAvailability?.totalRooms ?? currentBuilding.rooms}
                          </span>
                        )}
                      </div>
                      {!roomOk && !isPastSlot && (
                        <div className="text-[10px] text-warning mt-0.5">Rooms full</div>
                      )}
                    </div>

                    {therapists.map((t) => {
                      const sessionId = schedule[viewDay]?.[hour]?.[t.id]
                      const session = sessionId ? sessionById.get(sessionId) : undefined
                      const tWorkInfo = therapistWorkHours.get(t.id)
                      const isOutsideWorkHours = tWorkInfo && (hour < tWorkInfo.startHour || hour >= tWorkInfo.endHour)
                      const isOnBreak = tWorkInfo?.breakHours.includes(hour)

                      // Pass therapist to check work hours and lunch breaks
                      const therapistFree = !session && ScheduleManager.isSlotAvailable(schedule, t.id, viewDay, hour, 50, t)
                      const canClick = therapistFree && roomOk && !isPastSlot && !!onSlotClick

                      return (
                        <div
                          key={`${t.id}-${hour}`}
                          className={cn(
                            'px-3 py-2 border-b border-border',
                            isCurrentHour && 'bg-primary/5',
                            isPastSlot && !session && 'opacity-50',
                            isOutsideWorkHours && 'bg-muted/20'
                          )}
                        >
                          {session ? (
                            <SessionCard
                              session={session}
                              compact
                              onClick={onSessionClick ? () => onSessionClick(session) : undefined}
                            />
                          ) : isOnBreak && !isPastSlot ? (
                            <div className="w-full min-h-[56px] rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-center gap-2 text-sm text-warning">
                              <Coffee className="w-4 h-4" />
                              Break
                            </div>
                          ) : isOutsideWorkHours && !isPastSlot ? (
                            <div className="w-full min-h-[56px] rounded-lg bg-muted/30 flex items-center justify-center text-sm text-muted-foreground/50">
                              Off
                            </div>
                          ) : therapistFree && !isPastSlot ? (
                            <button
                              onClick={canClick ? () => onSlotClick(viewDay, hour, t.id) : undefined}
                              disabled={!roomOk || !onSlotClick}
                              className={cn(
                                'w-full min-h-[56px] rounded-lg border-2 border-dashed transition-colors',
                                'flex items-center justify-center gap-2 text-sm',
                                canClick
                                  ? 'border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground'
                                  : 'border-border bg-muted/30 text-muted-foreground/70 cursor-not-allowed'
                              )}
                            >
                              {roomOk ? 'Book' : telehealthUnlocked ? 'Virtual only' : 'Unavailable'}
                            </button>
                          ) : (
                            <div className="w-full min-h-[56px] rounded-lg bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
                              {isPastSlot && !session ? '' : 'Unavailable'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {timeSlots.map((hour) => {
              const sessionId = schedule[viewDay]?.[hour]?.[activeTherapist.id]
              const session = sessionId ? sessionById.get(sessionId) : undefined
              const therapistInfo = therapistWorkHours.get(activeTherapist.id)
              const isOnBreak = therapistInfo?.breakHours.includes(hour)

              // Pass therapist to check work hours and lunch breaks
              const therapistFree = ScheduleManager.isSlotAvailable(schedule, activeTherapist.id, viewDay, hour, 50, activeTherapist)
              const roomOk =
                telehealthUnlocked ||
                !currentBuilding ||
                (roomAvailabilityByHour.get(hour)?.roomsAvailable ?? 1) > 0
              const isPastSlot = !ScheduleManager.validateNotInPast(
                { day: currentDay, hour: currentHour, minute: currentMinute },
                viewDay,
                hour
              ).valid
              const isAvailable = !session && therapistFree && roomOk && !isPastSlot
              const isCurrent = viewDay === currentDay && hour === currentHour

              // Show a special break slot if the therapist is on break
              if (isOnBreak && !session) {
                return (
                  <div
                    key={hour}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3',
                      isCurrent && 'bg-primary/5',
                      isPastSlot && 'opacity-50'
                    )}
                  >
                    <div className="w-16 text-sm text-muted-foreground shrink-0">
                      {ScheduleManager.formatHour(hour)}
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
                      <Coffee className="w-4 h-4" />
                      Break
                    </div>
                  </div>
                )
              }

              return (
                <TimeSlot
                  key={hour}
                  hour={hour}
                  session={session}
                  isAvailable={isAvailable}
                  isCurrent={isCurrent}
                  isPast={isPastSlot}
                  onSlotClick={isAvailable && onSlotClick ? () => onSlotClick(viewDay, hour, activeTherapist.id) : undefined}
                  onSessionClick={onSessionClick}
                />
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
