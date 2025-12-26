import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Building, Session, Therapist, Schedule } from '@/core/types'
import { ScheduleManager, SCHEDULE_CONFIG } from '@/core/schedule'
import { OfficeManager } from '@/core/office'
import { TimeSlot } from './TimeSlot'
import { SessionCard } from './SessionCard'
import { Card, Button, Badge } from '@/components/ui'
import { ChevronLeft, ChevronRight, Calendar, User, Video, Building as BuildingIcon, CalendarCheck } from 'lucide-react'

export interface ScheduleViewProps {
  /** Current game day */
  currentDay: number
  /** Current game hour */
  currentHour: number
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

  // Generate time slots for the day
  const timeSlots = useMemo(() => {
    const slots: number[] = []
    for (let hour = SCHEDULE_CONFIG.BUSINESS_START; hour < SCHEDULE_CONFIG.BUSINESS_END; hour++) {
      slots.push(hour)
    }
    return slots
  }, [])

  // Count virtual vs in-person sessions
  const sessionTypeCounts = useMemo(() => {
    const sessionsArray = viewMode === 'grid' ? allDaySessions : activeTherapistSessions
    const virtual = sessionsArray.filter((s) => s.isVirtual).length
    return { virtual, inPerson: sessionsArray.length - virtual }
  }, [viewMode, allDaySessions, activeTherapistSessions])

  const availableSlotsCount = useMemo(() => {
    if (viewMode === 'grid') {
      let count = 0
      for (const hour of timeSlots) {
        const hourHasAnyBookableCell = therapists.some((t) => {
          const sessionId = schedule[viewDay]?.[hour]?.[t.id]
          if (sessionId) return false

          const therapistFree = ScheduleManager.isSlotAvailable(schedule, t.id, viewDay, hour)
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
    if (telehealthUnlocked || !currentBuilding) return baseSlots.length

    return baseSlots.filter((hour) => (roomAvailabilityByHour.get(hour)?.roomsAvailable ?? 1) > 0).length
  }, [
    viewMode,
    timeSlots,
    therapists,
    schedule,
    viewDay,
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

                return (
                  <div key={hour} className={cn('contents', isCurrentHour && 'bg-primary/5')}>
                    <div
                      className={cn(
                        'px-3 py-2 text-sm text-muted-foreground border-b border-border',
                        isCurrentHour && 'bg-primary/5'
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
                      {!roomOk && (
                        <div className="text-[10px] text-warning mt-0.5">Rooms full</div>
                      )}
                    </div>

                    {therapists.map((t) => {
                      const sessionId = schedule[viewDay]?.[hour]?.[t.id]
                      const session = sessionId ? sessionById.get(sessionId) : undefined

                      const therapistFree = !session && ScheduleManager.isSlotAvailable(schedule, t.id, viewDay, hour)
                      const canClick = therapistFree && roomOk && !!onSlotClick

                      return (
                        <div
                          key={`${t.id}-${hour}`}
                          className={cn(
                            'px-3 py-2 border-b border-border',
                            isCurrentHour && 'bg-primary/5'
                          )}
                        >
                          {session ? (
                            <SessionCard
                              session={session}
                              compact
                              onClick={onSessionClick ? () => onSessionClick(session) : undefined}
                            />
                          ) : therapistFree ? (
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
                              Unavailable
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

              const therapistFree = ScheduleManager.isSlotAvailable(schedule, activeTherapist.id, viewDay, hour)
              const roomOk =
                telehealthUnlocked ||
                !currentBuilding ||
                (roomAvailabilityByHour.get(hour)?.roomsAvailable ?? 1) > 0
              const isAvailable = !session && therapistFree && roomOk
              const isCurrent = viewDay === currentDay && hour === currentHour

              return (
                <TimeSlot
                  key={hour}
                  hour={hour}
                  session={session}
                  isAvailable={isAvailable}
                  isCurrent={isCurrent}
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
