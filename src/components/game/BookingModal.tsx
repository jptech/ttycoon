import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Building, Client, Therapist, Schedule, Session, SessionDuration } from '@/core/types'
import { planRecurringBookings, ScheduleManager, SCHEDULE_CONFIG } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import { Modal, ModalFooter, Button, Card } from '@/components/ui'
import { Clock, User, Video, Building as BuildingIcon, Calendar, Check, AlertTriangle, CalendarClock } from 'lucide-react'

export interface BookingModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Available clients to book */
  clients: Client[]
  /** Available therapists */
  therapists: Therapist[]
  /** Current schedule */
  schedule: Schedule
  /** All sessions (used for room-capacity checks) */
  sessions: Session[]
  /** Current building (room capacity) */
  currentBuilding: Building
  /** Whether telehealth is unlocked */
  telehealthUnlocked: boolean
  /** Current time, for not-in-past validation */
  currentDay: number
  currentHour: number
  currentMinute: number
  /** Pre-selected slot */
  selectedSlot?: {
    day: number
    hour: number
    therapistId: string
  }
  /** Callback when a session is booked */
  onBook: (params: {
    clientId: string
    therapistId: string
    day: number
    hour: number
    duration: SessionDuration
    isVirtual: boolean
  }) => { success: boolean; error?: string } | void
}

export function BookingModal({
  open,
  onClose,
  clients,
  therapists,
  schedule,
  sessions,
  currentBuilding,
  telehealthUnlocked,
  currentDay,
  currentHour,
  currentMinute,
  selectedSlot,
  onBook,
}: BookingModalProps) {
  // State
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(
    selectedSlot?.therapistId || null
  )
  const [selectedDay, setSelectedDay] = useState<number | null>(selectedSlot?.day || null)
  const [selectedHour, setSelectedHour] = useState<number | null>(selectedSlot?.hour || null)
  const [duration, setDuration] = useState<SessionDuration>(SCHEDULE_CONFIG.DEFAULT_DURATION)
  const [isVirtual, setIsVirtual] = useState(false)
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringCount, setRecurringCount] = useState(4)
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(7)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Reset state when modal opens/closes
  const resetState = () => {
    setSelectedClientId(null)
    setSelectedTherapistId(selectedSlot?.therapistId || null)
    setSelectedDay(selectedSlot?.day || null)
    setSelectedHour(selectedSlot?.hour || null)
    setDuration(SCHEDULE_CONFIG.DEFAULT_DURATION)
    setIsVirtual(false)
    setRecurringEnabled(false)
    setRecurringCount(4)
    setRecurringIntervalDays(7)
    setBookingError(null)
  }

  // Get selected entities
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  )

  const selectedTherapist = useMemo(
    () => therapists.find((t) => t.id === selectedTherapistId),
    [therapists, selectedTherapistId]
  )

  // Map client frequency to interval days
  const getIntervalFromFrequency = (frequency: string): number => {
    switch (frequency) {
      case 'weekly': return 7
      case 'biweekly': return 14
      case 'monthly': return 30
      default: return 7
    }
  }

  // Filter clients that are waiting and can be scheduled
  const availableClients = useMemo(
    () => clients.filter((c) => c.status === 'waiting' || c.status === 'in_treatment'),
    [clients]
  )

  // Get available slots for selected therapist
  const availableSlots = useMemo(() => {
    if (!selectedTherapistId) return []

    const therapist = therapists.find((t) => t.id === selectedTherapistId)
    if (!therapist) return []

    // Find slots for next 5 days
    const startDay = selectedSlot?.day || currentDay
    const baseSlots = ScheduleManager.findMatchingSlots(
      schedule,
      therapist,
      selectedClient || {
        availability: {
          monday: [9, 10, 11, 14, 15, 16],
          tuesday: [9, 10, 11, 14, 15, 16],
          wednesday: [9, 10, 11, 14, 15, 16],
          thursday: [9, 10, 11, 14, 15, 16],
          friday: [9, 10, 11, 14, 15, 16],
        },
        preferredTime: 'any',
      } as Client,
      startDay,
      5,
      duration
    )

    const notInPastSlots = baseSlots.filter((slot) => {
      const timeCheck = ScheduleManager.validateNotInPast(
        { day: currentDay, hour: currentHour, minute: currentMinute },
        slot.day,
        slot.hour
      )
      return timeCheck.valid
    })

    if (isVirtual) {
      if (!telehealthUnlocked) return []
      return notInPastSlots
    }

    return notInPastSlots.filter((slot) => {
      const check = canBookSessionType({
        building: currentBuilding,
        sessions,
        telehealthUnlocked,
        isVirtual: false,
        day: slot.day,
        hour: slot.hour,
        durationMinutes: duration,
      })
      return check.canBook
    })
  }, [
    selectedTherapistId,
    therapists,
    schedule,
    selectedClient,
    selectedSlot,
    duration,
    isVirtual,
    telehealthUnlocked,
    currentBuilding,
    sessions,
    currentDay,
    currentHour,
    currentMinute,
  ])

  // Can book check
  const bookingTypeCheck = useMemo(() => {
    if (!selectedDay || selectedHour === null) return null
    return canBookSessionType({
      building: currentBuilding,
      sessions,
      telehealthUnlocked,
      isVirtual,
      day: selectedDay,
      hour: selectedHour,
      durationMinutes: duration,
    })
  }, [currentBuilding, sessions, telehealthUnlocked, isVirtual, selectedDay, selectedHour, duration])

  const canBook =
    !!selectedClientId &&
    !!selectedTherapistId &&
    selectedDay !== null &&
    selectedHour !== null &&
    (bookingTypeCheck?.canBook ?? true)

  const recurringPlan = useMemo(() => {
    if (!recurringEnabled) return null
    if (!selectedClient || !selectedTherapist || selectedDay === null || selectedHour === null) return null

    return planRecurringBookings({
      schedule,
      sessions,
      therapist: selectedTherapist,
      client: selectedClient,
      building: currentBuilding,
      telehealthUnlocked,
      currentTime: { day: currentDay, hour: currentHour, minute: currentMinute },
      startDay: selectedDay,
      startHour: selectedHour,
      durationMinutes: duration,
      isVirtual,
      count: recurringCount,
      intervalDays: recurringIntervalDays,
    })
  }, [
    recurringEnabled,
    selectedClient,
    selectedTherapist,
    selectedDay,
    selectedHour,
    schedule,
    sessions,
    currentBuilding,
    telehealthUnlocked,
    currentDay,
    currentHour,
    currentMinute,
    duration,
    isVirtual,
    recurringCount,
    recurringIntervalDays,
  ])

  const recurringPlanComplete =
    recurringPlan && recurringPlan.failures.length === 0 && recurringPlan.planned.length === recurringCount

  // Handle booking
  const handleBook = () => {
    if (!canBook) return

    setBookingError(null)

    if (recurringEnabled) {
      if (!recurringPlanComplete || !recurringPlan) {
        setBookingError('Cannot book recurring series: one or more sessions are not schedulable.')
        return
      }

      for (const [index, slot] of recurringPlan.planned.entries()) {
        const result = onBook({
          clientId: selectedClientId!,
          therapistId: selectedTherapistId!,
          day: slot.day,
          hour: slot.hour,
          duration,
          isVirtual,
        })

        const ok = result === undefined || result.success
        if (!ok) {
          setBookingError(
            (result === undefined ? undefined : result.error) ||
              `Booking failed for session ${index + 1} of ${recurringPlan.planned.length}.`
          )
          return
        }
      }

      resetState()
      onClose()
      return
    }

    onBook({
      clientId: selectedClientId!,
      therapistId: selectedTherapistId!,
      day: selectedDay!,
      hour: selectedHour!,
      duration,
      isVirtual,
    })

    resetState()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        resetState()
        onClose()
      }}
      title="Book Session"
      size="lg"
    >
      <div className="space-y-6">
        {bookingError && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/40 bg-warning/10 text-warning text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{bookingError}</span>
          </div>
        )}
        {/* Step 1: Select Client */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Select Client
          </h4>
          {availableClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients available for booking</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {availableClients.map((client) => {
                const clientRemaining = Math.max(0, client.sessionsRequired - client.sessionsCompleted)
                return (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id)
                    setIsVirtual(client.prefersVirtual)
                    // Auto-populate recurring settings based on client needs
                    if (clientRemaining > 1) {
                      setRecurringEnabled(true)
                      setRecurringCount(Math.min(clientRemaining, 12))
                      setRecurringIntervalDays(getIntervalFromFrequency(client.preferredFrequency))
                    } else {
                      setRecurringEnabled(false)
                    }
                  }}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    selectedClientId === client.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium text-sm">{client.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {client.conditionCategory} • {clientRemaining} remaining
                    {clientRemaining > 1 && ` • ${client.preferredFrequency}`}
                  </div>
                </button>
              )})}

            </div>
          )}
        </div>

        {/* Step 2: Select Therapist */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Select Therapist
          </h4>
          <div className="flex gap-2 flex-wrap">
            {therapists.map((therapist) => (
              <button
                key={therapist.id}
                onClick={() => setSelectedTherapistId(therapist.id)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm transition-colors',
                  selectedTherapistId === therapist.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {therapist.displayName}
                {therapist.isPlayer && ' (You)'}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Select Time Slot */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Select Time
          </h4>
          {!selectedTherapistId ? (
            <p className="text-sm text-muted-foreground">Select a therapist first</p>
          ) : availableSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No available slots</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {/* Group by day */}
              {Array.from(new Set(availableSlots.map((s) => s.day))).map((day) => (
                <div key={day}>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Day {day}</div>
                  <div className="flex gap-1 flex-wrap">
                    {availableSlots
                      .filter((s) => s.day === day)
                      .map((slot) => (
                        <button
                          key={`${slot.day}-${slot.hour}`}
                          onClick={() => {
                            setSelectedDay(slot.day)
                            setSelectedHour(slot.hour)
                          }}
                          className={cn(
                            'px-2 py-1 rounded text-xs transition-colors',
                            selectedDay === slot.day && selectedHour === slot.hour
                              ? 'bg-primary text-primary-foreground'
                              : slot.isPreferred
                                ? 'bg-success/10 text-success hover:bg-success/20'
                                : 'bg-muted hover:bg-muted-foreground/10'
                          )}
                        >
                          {ScheduleManager.formatHour(slot.hour)}
                          {slot.isPreferred && ' ★'}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 4: Session Options */}
        <div className="grid grid-cols-2 gap-4">
          {/* Duration */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration
            </h4>
            <div className="flex gap-2">
              {([50, 80] as SessionDuration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    duration === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted-foreground/10'
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <h4 className="font-medium mb-2">Location</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setIsVirtual(false)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  !isVirtual
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted-foreground/10'
                )}
              >
                <BuildingIcon className="w-4 h-4" />
                In-Office
              </button>
              <button
                onClick={() => {
                  if (!telehealthUnlocked) return
                  setIsVirtual(true)
                }}
                disabled={!telehealthUnlocked}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  isVirtual
                    ? 'bg-primary text-primary-foreground'
                    : telehealthUnlocked
                      ? 'bg-muted hover:bg-muted-foreground/10'
                      : 'bg-muted text-muted-foreground/60 cursor-not-allowed'
                )}
              >
                <Video className="w-4 h-4" />
                Virtual
              </button>
            </div>
          </div>
        </div>

        {/* Recurring */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Recurring
          </h4>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRecurringEnabled((v) => !v)}
              className={cn(
                'px-3 py-1.5 rounded-md border text-sm transition-colors',
                recurringEnabled ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              )}
            >
              {recurringEnabled ? 'Enabled' : 'Disabled'}
            </button>

            {recurringEnabled && (
              <>
                <div className="flex gap-1">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setRecurringIntervalDays(d)}
                      className={cn(
                        'px-2 py-1 rounded text-xs border transition-colors',
                        recurringIntervalDays === d
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:border-primary/50'
                      )}
                    >
                      {d === 7 ? 'Week' : d === 14 ? '2 Weeks' : 'Month'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Count</span>
                  <input
                    aria-label="Recurring session count"
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    type="number"
                    min={1}
                    max={12}
                    value={recurringCount}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setRecurringCount(Number.isFinite(next) ? Math.max(1, Math.min(12, next)) : 1)
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {recurringEnabled && selectedDay !== null && selectedHour !== null && (
            <div className="mt-2 text-xs text-muted-foreground">
              {recurringPlanComplete
                ? `Planned ${recurringCount} sessions.`
                : recurringPlan?.failures[0]?.reason || 'Some sessions in this series cannot be scheduled.'}
            </div>
          )}
        </div>

        {/* Summary */}
        {canBook && (
          <Card variant="default" className="bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-success" />
              <span>
                <strong>{selectedClient?.displayName}</strong> with{' '}
                <strong>{selectedTherapist?.displayName}</strong> on Day {selectedDay} at{' '}
                {ScheduleManager.formatHour(selectedHour!)} ({duration} min,{' '}
                {isVirtual ? 'virtual' : 'in-office'})
              </span>
            </div>
          </Card>
        )}
      </div>

      <ModalFooter>
        <Button
          variant="ghost"
          onClick={() => {
            resetState()
            onClose()
          }}
        >
          Cancel
        </Button>
        <Button onClick={handleBook} disabled={!canBook || (recurringEnabled && !recurringPlanComplete)}>
          {recurringEnabled ? `Book ${recurringCount} Sessions` : 'Book Session'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
