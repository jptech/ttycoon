import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Session, Therapist, Schedule } from '@/core/types'
import { ScheduleManager, SCHEDULE_CONFIG } from '@/core/schedule'
import { TimeSlot } from './TimeSlot'
import { Card, Button, Badge } from '@/components/ui'
import { ChevronLeft, ChevronRight, Calendar, User, Video, Building } from 'lucide-react'

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
    selectedTherapistId,
    onTherapistSelect,
    onSlotClick,
    onSessionClick,
    className,
  } = props
  // Note: view prop reserved for future week view implementation
  const [viewDay, setViewDay] = useState(currentDay)

  // Get the selected therapist (default to first/player)
  const activeTherapist = useMemo(() => {
    if (selectedTherapistId) {
      return therapists.find((t) => t.id === selectedTherapistId)
    }
    return therapists.find((t) => t.isPlayer) || therapists[0]
  }, [therapists, selectedTherapistId])

  // Get sessions for the view day
  const daySessions = useMemo(() => {
    if (!activeTherapist) return new Map<number, Session>()

    const sessionsMap = new Map<number, Session>()
    const therapistSessions = ScheduleManager.getTherapistSessionsForDay(
      schedule,
      sessions,
      activeTherapist.id,
      viewDay
    )

    for (const session of therapistSessions) {
      sessionsMap.set(session.scheduledHour, session)
    }

    return sessionsMap
  }, [schedule, sessions, activeTherapist, viewDay])

  // Get available slots
  const availableSlots = useMemo(() => {
    if (!activeTherapist) return new Set<number>()

    const slots = ScheduleManager.getAvailableSlotsForDay(schedule, activeTherapist.id, viewDay)
    return new Set(slots)
  }, [schedule, activeTherapist, viewDay])

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
    const sessionsArray = Array.from(daySessions.values())
    const virtual = sessionsArray.filter((s) => s.isVirtual).length
    return { virtual, inPerson: sessionsArray.length - virtual }
  }, [daySessions])

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

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Schedule</h2>
        </div>

        {/* Day navigation */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPreviousDay} disabled={viewDay <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <button
            onClick={goToToday}
            className={cn(
              'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
              viewDay === currentDay
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted-foreground/10'
            )}
          >
            Day {viewDay}
            {viewDay === currentDay && ' (Today)'}
          </button>

          <Button variant="ghost" size="sm" onClick={goToNextDay}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Therapist selector (if multiple) */}
      {therapists.length > 1 && (
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
      )}

      {/* Schedule summary */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <div className="flex items-center gap-3">
          <Badge variant="info">{daySessions.size} sessions</Badge>
          {daySessions.size > 0 && (
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Video className="w-3 h-3 text-info" />
                {sessionTypeCounts.virtual}
              </span>
              <span className="flex items-center gap-1">
                <Building className="w-3 h-3 text-warning" />
                {sessionTypeCounts.inPerson}
              </span>
            </span>
          )}
          <Badge variant="success">{availableSlots.size} available</Badge>
          {!ScheduleManager.canScheduleMoreToday(schedule, sessions, activeTherapist.id, viewDay) && (
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
        <div className="divide-y divide-border">
          {timeSlots.map((hour) => {
            const session = daySessions.get(hour)
            const isAvailable = availableSlots.has(hour)
            const isCurrent = viewDay === currentDay && hour === currentHour

            return (
              <TimeSlot
                key={hour}
                hour={hour}
                session={session}
                isAvailable={isAvailable && !session}
                isCurrent={isCurrent}
                onSlotClick={
                  isAvailable && !session && onSlotClick
                    ? () => onSlotClick(viewDay, hour, activeTherapist.id)
                    : undefined
                }
                onSessionClick={onSessionClick}
              />
            )
          })}
        </div>
      </Card>
    </div>
  )
}
