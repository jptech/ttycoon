import { useMemo, useState } from 'react'
import type { Building, Client, Therapist, Session, SessionDuration } from '@/core/types'
import { ScheduleManager } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import { Modal, ModalFooter, Button, Card, Badge } from '@/components/ui'
import { cn, formatTime } from '@/lib/utils'
import { Calendar, Clock, Video, Building as BuildingIcon, User, AlertTriangle } from 'lucide-react'

export interface ManageBookingModalProps {
  open: boolean
  onClose: () => void

  session: Session
  clients: Client[]
  therapists: Therapist[]
  sessions: Session[]
  currentBuilding: Building
  telehealthUnlocked: boolean
  currentDay: number
  currentHour: number
  currentMinute: number

  onCancel: (sessionId: string) => { success: boolean; error?: string } | void
  onReschedule: (params: {
    sessionId: string
    therapistId: string
    day: number
    hour: number
    duration: SessionDuration
    isVirtual: boolean
  }) => { success: boolean; error?: string } | void
}

export function ManageBookingModal(props: ManageBookingModalProps) {
  const {
    open,
    onClose,
    session,
    clients,
    therapists,
    sessions,
    currentBuilding,
    telehealthUnlocked,
    currentDay,
    currentHour,
    currentMinute,
    onCancel,
    onReschedule,
  } = props

  const client = useMemo(() => clients.find((c) => c.id === session.clientId), [clients, session.clientId])
  const initialTherapistId = session.therapistId

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId)
  const [duration, setDuration] = useState<SessionDuration>(session.durationMinutes)
  const [isVirtual, setIsVirtual] = useState<boolean>(session.isVirtual)
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; hour: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentTime = useMemo(
    () => ({ day: currentDay, hour: currentHour, minute: currentMinute }),
    [currentDay, currentHour, currentMinute]
  )

  const canCancel = useMemo(() => {
    const check = ScheduleManager.validateNotInPast(currentTime, session.scheduledDay, session.scheduledHour)
    return session.status === 'scheduled' && check.valid
  }, [currentTime, session.scheduledDay, session.scheduledHour, session.status])

  const sessionsWithoutThis = useMemo(
    () => sessions.filter((s) => s.id !== session.id),
    [sessions, session.id]
  )

  const scheduleWithoutThis = useMemo(
    () => ScheduleManager.buildScheduleFromSessions(sessionsWithoutThis),
    [sessionsWithoutThis]
  )

  const selectedTherapist = useMemo(
    () => therapists.find((t) => t.id === selectedTherapistId) ?? null,
    [therapists, selectedTherapistId]
  )

  const availableSlots = useMemo(() => {
    if (!client || !selectedTherapist) return []

    const baseSlots = ScheduleManager.findMatchingSlots(
      scheduleWithoutThis,
      selectedTherapist,
      client,
      Math.max(currentDay, session.scheduledDay),
      10,
      duration
    )

    const notInPast = baseSlots.filter((slot) => {
      const timeCheck = ScheduleManager.validateNotInPast(currentTime, slot.day, slot.hour)
      return timeCheck.valid
    })

    if (isVirtual) {
      if (!telehealthUnlocked) return []
      return notInPast
    }

    return notInPast.filter((slot) => {
      const typeCheck = canBookSessionType({
        building: currentBuilding,
        sessions: sessionsWithoutThis,
        telehealthUnlocked,
        isVirtual: false,
        day: slot.day,
        hour: slot.hour,
        durationMinutes: duration,
      })
      return typeCheck.canBook
    })
  }, [
    client,
    selectedTherapist,
    scheduleWithoutThis,
    currentDay,
    session.scheduledDay,
    duration,
    currentTime,
    isVirtual,
    telehealthUnlocked,
    currentBuilding,
    sessionsWithoutThis,
  ])

  const slotCountLabel = useMemo(() => {
    if (!client || !selectedTherapist) return 'Select therapist'
    return `${availableSlots.length} slots`
  }, [availableSlots.length, client, selectedTherapist])

  const isSlotSelected = (day: number, hour: number) => selectedSlot?.day === day && selectedSlot?.hour === hour

  const handleCancel = () => {
    setError(null)
    if (!canCancel) {
      setError('Cannot cancel a session in the past.')
      return
    }

    const result = onCancel(session.id)
    const ok = result === undefined || result.success
    if (!ok) {
      setError(result?.error || 'Cancel failed')
      return
    }

    onClose()
  }

  const handleReschedule = () => {
    setError(null)

    if (!selectedTherapist || !client) {
      setError('Missing therapist or client.')
      return
    }

    if (!selectedSlot) {
      setError('Please pick a new time slot.')
      return
    }

    const result = onReschedule({
      sessionId: session.id,
      therapistId: selectedTherapist.id,
      day: selectedSlot.day,
      hour: selectedSlot.hour,
      duration,
      isVirtual,
    })

    const ok = result === undefined || result.success
    if (!ok) {
      setError(result?.error || 'Reschedule failed')
      return
    }

    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Booking" size="lg">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                {session.clientName}
              </div>
              <div className="text-sm text-muted-foreground">with {session.therapistName}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Day {session.scheduledDay}, {ScheduleManager.formatHour(session.scheduledHour)}
                </span>
                <Badge variant={session.isVirtual ? 'info' : 'warning'} size="sm">
                  {session.isVirtual ? 'Virtual' : 'Office'}
                </Badge>
                <Badge variant="outline" size="sm">{session.durationMinutes} min</Badge>
              </div>
            </div>
            <Badge variant={session.status === 'scheduled' ? 'default' : 'outline'}>{session.status}</Badge>
          </div>
        </Card>

        {/* Cancel */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Cancel</div>
              <div className="text-xs text-muted-foreground">
                You cannot cancel sessions that are already in the past.
              </div>
            </div>
            <Button variant="danger" onClick={handleCancel} disabled={!canCancel}>
              Cancel Session
            </Button>
          </div>
        </Card>

        {/* Reschedule */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">Reschedule</div>
              <div className="text-xs text-muted-foreground">Must satisfy standard booking constraints.</div>
            </div>
            <Badge variant="outline">{slotCountLabel}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Therapist */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Therapist</div>
              <select
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40'
                )}
                value={selectedTherapistId}
                onChange={(e) => {
                  setSelectedTherapistId(e.target.value)
                  setSelectedSlot(null)
                }}
              >
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Duration</div>
              <div className="flex gap-1">
                {([50, 80, 180] as SessionDuration[]).map((dur) => (
                  <button
                    key={dur}
                    onClick={() => {
                      setDuration(dur)
                      setSelectedSlot(null)
                    }}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      duration === dur
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
            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Session Type</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsVirtual(false)
                    setSelectedSlot(null)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors',
                    !isVirtual
                      ? 'bg-warning/15 text-warning'
                      : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                  )}
                >
                  <BuildingIcon className="w-4 h-4" />
                  Office
                </button>
                <button
                  onClick={() => {
                    if (!telehealthUnlocked) return
                    setIsVirtual(true)
                    setSelectedSlot(null)
                  }}
                  disabled={!telehealthUnlocked}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors',
                    isVirtual
                      ? 'bg-info/15 text-info'
                      : telehealthUnlocked
                        ? 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                        : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  <Video className="w-4 h-4" />
                  Virtual
                </button>
              </div>
            </div>
          </div>

          {/* Slot list */}
          <div>
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Pick a new time (cannot be in the past)
            </div>

            {availableSlots.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No valid slots found.
              </div>
            ) : (
              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                {availableSlots.slice(0, 60).map((slot) => (
                  <button
                    key={`${slot.day}-${slot.hour}`}
                    onClick={() => setSelectedSlot({ day: slot.day, hour: slot.hour })}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-b-0',
                      'hover:bg-muted/40 transition-colors',
                      isSlotSelected(slot.day, slot.hour) && 'bg-primary/10'
                    )}
                  >
                    <span>
                      Day {slot.day} • {formatTime(slot.hour, 0)}
                    </span>
                    {slot.isPreferred && <Badge variant="success" size="sm">Preferred</Badge>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {error && (
          <div className="text-sm text-error flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={handleReschedule}
          disabled={session.status !== 'scheduled' || !selectedSlot}
        >
          Reschedule
        </Button>
      </ModalFooter>
    </Modal>
  )
}
