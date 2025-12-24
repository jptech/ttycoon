import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Building, Client, Therapist, Schedule, Session, SessionDuration } from '@/core/types'
import { ScheduleManager, SCHEDULE_CONFIG } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import { Modal, ModalFooter, Button, Card } from '@/components/ui'
import { Clock, User, Video, Building as BuildingIcon, Calendar, Check } from 'lucide-react'

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
  }) => void
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

  // Reset state when modal opens/closes
  const resetState = () => {
    setSelectedClientId(null)
    setSelectedTherapistId(selectedSlot?.therapistId || null)
    setSelectedDay(selectedSlot?.day || null)
    setSelectedHour(selectedSlot?.hour || null)
    setDuration(SCHEDULE_CONFIG.DEFAULT_DURATION)
    setIsVirtual(false)
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
    const startDay = selectedSlot?.day || 1
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

  // Handle booking
  const handleBook = () => {
    if (!canBook) return

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
              {availableClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id)
                    setIsVirtual(client.prefersVirtual)
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
                    {client.conditionCategory} • {client.sessionsCompleted}/{client.sessionsRequired} sessions
                  </div>
                </button>
              ))}
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
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleBook} disabled={!canBook}>
          Book Session
        </Button>
      </ModalFooter>
    </Modal>
  )
}
