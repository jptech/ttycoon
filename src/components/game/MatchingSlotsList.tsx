import { useMemo, useState } from 'react'
import type { Building, Client, Therapist, Schedule, Session, SessionDuration } from '@/core/types'
import { ScheduleManager } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import { Badge, Button, Card } from '@/components/ui'
import { Calendar, Clock, Star, Video, Building as BuildingIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MatchingSlotInfo {
  day: number
  hour: number
  therapistId: string
  isPreferred: boolean
}

export interface MatchingSlotsListProps {
  client: Client
  therapist: Therapist
  schedule: Schedule
  sessions: Session[]
  currentBuilding: Building
  telehealthUnlocked: boolean
  currentDay: number
  daysToShow?: number
  onSelectSlot: (slot: MatchingSlotInfo, duration: SessionDuration, isVirtual: boolean) => void
  className?: string
}

interface GroupedSlots {
  day: number
  morning: MatchingSlotInfo[]
  afternoon: MatchingSlotInfo[]
  evening: MatchingSlotInfo[]
}

const TIME_PERIODS: Record<string, { label: string; range: string; hours: number[] }> = {
  morning: { label: 'Morning', range: '8am-12pm', hours: [8, 9, 10, 11] },
  afternoon: { label: 'Afternoon', range: '12pm-4pm', hours: [12, 13, 14, 15] },
  evening: { label: 'Evening', range: '4pm-6pm', hours: [16, 17] },
}

export function MatchingSlotsList({
  client,
  therapist,
  schedule,
  sessions,
  currentBuilding,
  telehealthUnlocked,
  currentDay,
  daysToShow = 7,
  onSelectSlot,
  className,
}: MatchingSlotsListProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([currentDay, currentDay + 1]))
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration>(50)
  const [isVirtual, setIsVirtual] = useState(client.prefersVirtual)
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; hour: number } | null>(null)

  // Find matching slots
  const slots = useMemo(() => {
    const baseSlots = ScheduleManager.findMatchingSlots(
      schedule,
      therapist,
      client,
      currentDay,
      daysToShow,
      selectedDuration
    )

    // Filter based on selected session type constraints.
    if (isVirtual) {
      if (!telehealthUnlocked) return []
      return baseSlots
    }

    return baseSlots.filter((slot) => {
      const check = canBookSessionType({
        building: currentBuilding,
        sessions,
        telehealthUnlocked,
        isVirtual: false,
        day: slot.day,
        hour: slot.hour,
        durationMinutes: selectedDuration,
      })
      return check.canBook
    })
  }, [
    schedule,
    therapist,
    client,
    currentDay,
    daysToShow,
    selectedDuration,
    isVirtual,
    telehealthUnlocked,
    currentBuilding,
    sessions,
  ])

  // Group slots by day and time period
  const groupedSlots = useMemo(() => {
    const groups: GroupedSlots[] = []

    for (let d = currentDay; d < currentDay + daysToShow; d++) {
      const daySlots = slots.filter((s) => s.day === d)
      if (daySlots.length === 0) continue

      groups.push({
        day: d,
        morning: daySlots.filter((s) => TIME_PERIODS.morning.hours.includes(s.hour)),
        afternoon: daySlots.filter((s) => TIME_PERIODS.afternoon.hours.includes(s.hour)),
        evening: daySlots.filter((s) => TIME_PERIODS.evening.hours.includes(s.hour)),
      })
    }

    return groups
  }, [slots, currentDay, daysToShow])

  const toggleDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }

  const isPreferredPeriod = (period: 'morning' | 'afternoon' | 'evening') => {
    if (client.preferredTime === 'any') return false
    return client.preferredTime === period
  }

  const handleSlotClick = (slot: MatchingSlotInfo) => {
    setSelectedSlot({ day: slot.day, hour: slot.hour })
    onSelectSlot(slot, selectedDuration, isVirtual)
  }

  const isSlotSelected = (slot: MatchingSlotInfo) => {
    return selectedSlot?.day === slot.day && selectedSlot?.hour === slot.hour
  }

  if (isVirtual && !telehealthUnlocked) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Virtual sessions require Telehealth.</p>
        <p className="text-xs">Unlock it in the Office tab.</p>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No available slots in the next {daysToShow} days</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Available Time Slots
        </h4>

        {/* Session options */}
        <div className="flex items-center gap-3">
          {/* Duration */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Duration:</span>
            <div className="flex gap-1">
              {([50, 80] as SessionDuration[]).map((dur) => (
                <button
                  key={dur}
                  onClick={() => setSelectedDuration(dur)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    selectedDuration === dur
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted-foreground/10'
                  )}
                >
                  {dur}min
                </button>
              ))}
            </div>
          </div>

          {/* Virtual toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsVirtual(false)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                !isVirtual
                  ? 'bg-warning/15 text-warning'
                  : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
              )}
            >
              <BuildingIcon className="w-3 h-3" />
              Office
            </button>
            <button
              onClick={() => {
                if (!telehealthUnlocked) return
                setIsVirtual(true)
              }}
              disabled={!telehealthUnlocked}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                isVirtual
                  ? 'bg-info/15 text-info'
                  : telehealthUnlocked
                    ? 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                    : 'bg-muted text-muted-foreground/60 cursor-not-allowed'
              )}
            >
              <Video className="w-3 h-3" />
              Virtual
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-success fill-success" />
          Matches preference
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          Available
        </span>
      </div>

      {/* Grouped slots by day */}
      <div className="space-y-2">
        {groupedSlots.map(({ day, morning, afternoon, evening }) => {
          const isExpanded = expandedDays.has(day)
          const totalSlots = morning.length + afternoon.length + evening.length
          const preferredCount = [...morning, ...afternoon, ...evening].filter((s) => s.isPreferred).length

          return (
            <Card key={day} className="overflow-hidden">
              <button
                onClick={() => toggleDay(day)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Day {day}</span>
                  {day === currentDay && (
                    <Badge variant="info" size="sm">
                      Today
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{totalSlots} slots</span>
                  {preferredCount > 0 && (
                    <Badge variant="success" size="sm">
                      {preferredCount} preferred
                    </Badge>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3">
                  {/* Morning */}
                  {morning.length > 0 && (
                    <div>
                      <div
                        className={cn(
                          'text-xs font-medium mb-2',
                          isPreferredPeriod('morning') ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {TIME_PERIODS.morning.label} ({TIME_PERIODS.morning.range})
                        {isPreferredPeriod('morning') && ' - Preferred'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {morning.map((slot) => (
                          <SlotButton
                            key={`${slot.day}-${slot.hour}`}
                            slot={slot}
                            isSelected={isSlotSelected(slot)}
                            onClick={() => handleSlotClick(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afternoon */}
                  {afternoon.length > 0 && (
                    <div>
                      <div
                        className={cn(
                          'text-xs font-medium mb-2',
                          isPreferredPeriod('afternoon') ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {TIME_PERIODS.afternoon.label} ({TIME_PERIODS.afternoon.range})
                        {isPreferredPeriod('afternoon') && ' - Preferred'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {afternoon.map((slot) => (
                          <SlotButton
                            key={`${slot.day}-${slot.hour}`}
                            slot={slot}
                            isSelected={isSlotSelected(slot)}
                            onClick={() => handleSlotClick(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evening */}
                  {evening.length > 0 && (
                    <div>
                      <div
                        className={cn(
                          'text-xs font-medium mb-2',
                          isPreferredPeriod('evening') ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {TIME_PERIODS.evening.label} ({TIME_PERIODS.evening.range})
                        {isPreferredPeriod('evening') && ' - Preferred'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {evening.map((slot) => (
                          <SlotButton
                            key={`${slot.day}-${slot.hour}`}
                            slot={slot}
                            isSelected={isSlotSelected(slot)}
                            onClick={() => handleSlotClick(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// Slot button component
function SlotButton({
  slot,
  isSelected,
  onClick,
}: {
  slot: MatchingSlotInfo
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant={isSelected ? 'primary' : slot.isPreferred ? 'primary' : 'secondary'}
      size="sm"
      onClick={onClick}
      className={cn(
        'relative transition-all',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105',
        !isSelected && slot.isPreferred && 'bg-success hover:bg-success/90 border-success'
      )}
    >
      {slot.isPreferred && !isSelected && <Star className="w-3 h-3 mr-1 fill-current" />}
      {ScheduleManager.formatHour(slot.hour)}
    </Button>
  )
}
