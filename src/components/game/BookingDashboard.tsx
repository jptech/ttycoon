import { useState, useMemo, useCallback } from 'react'
import type { Building, Client, Therapist, Session, Schedule, SessionDuration } from '@/core/types'
import { ClientManager, type FollowUpInfo, FREQUENCY_DAYS } from '@/core/clients'
import { ScheduleManager } from '@/core/schedule'
import { ClientCard } from './ClientCard'
import { ClientPreferenceSummary } from './ClientPreferenceSummary'
import { TherapistMatchList } from './TherapistMatchList'
import { MatchingSlotsList, type MatchingSlotInfo } from './MatchingSlotsList'
import { ScheduleView } from './ScheduleView'
import { Card, Badge, Button } from '@/components/ui'
import {
  Users,
  UserCheck,
  X,
  CheckCircle,
  XCircle,
  Video,
  Building as BuildingIcon,
  Clock,
  Calendar,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BookingParams {
  clientId: string
  therapistId: string
  day: number
  hour: number
  duration: SessionDuration
  isVirtual: boolean
}

export interface BookingResult {
  success: boolean
  error?: string
}

export interface BookingDashboardProps {
  clients: Client[]
  therapists: Therapist[]
  sessions: Session[]
  schedule: Schedule
  currentBuilding: Building
  telehealthUnlocked: boolean
  currentDay: number
  currentHour: number
  onBook: (params: BookingParams) => BookingResult | void
  className?: string
}

type ClientView = 'waiting' | 'active' | 'all'
type FilterTimePreference = 'all' | 'morning' | 'afternoon' | 'evening'
type SortOption = 'priority' | 'arrival' | 'name' | 'urgency'

// Helper to get follow-up status display
function getFollowUpStatus(followUp: FollowUpInfo, currentDay: number): {
  label: string
  variant: 'error' | 'warning' | 'success' | 'info' | 'default'
  urgent: boolean
} {
  if (followUp.hasUpcomingSession && followUp.nextScheduledSession) {
    const daysUntil = followUp.nextScheduledSession.scheduledDay - currentDay
    if (daysUntil === 0) {
      return { label: 'Today', variant: 'info', urgent: false }
    }
    return { label: `In ${daysUntil}d`, variant: 'success', urgent: false }
  }

  if (followUp.isOverdue && followUp.daysUntilDue !== null) {
    const daysOverdue = Math.abs(followUp.daysUntilDue)
    return { label: `${daysOverdue}d overdue`, variant: 'error', urgent: true }
  }

  if (followUp.daysUntilDue !== null) {
    if (followUp.daysUntilDue <= 0) {
      return { label: 'Due now', variant: 'warning', urgent: true }
    }
    if (followUp.daysUntilDue <= 2) {
      return { label: `Due in ${followUp.daysUntilDue}d`, variant: 'warning', urgent: true }
    }
    return { label: `Due in ${followUp.daysUntilDue}d`, variant: 'default', urgent: false }
  }

  if (followUp.remainingSessions > 0) {
    return { label: 'Needs scheduling', variant: 'default', urgent: false }
  }

  return { label: 'Complete', variant: 'success', urgent: false }
}

export function BookingDashboard({
  clients,
  therapists,
  sessions,
  schedule,
  currentBuilding,
  telehealthUnlocked,
  currentDay,
  currentHour,
  onBook,
  className,
}: BookingDashboardProps) {
  // State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null)
  const [pendingBooking, setPendingBooking] = useState<{
    slot: MatchingSlotInfo
    duration: SessionDuration
    isVirtual: boolean
  } | null>(null)
  const [bookingFeedback, setBookingFeedback] = useState<{
    type: 'success' | 'error'
    message: string
    clientName: string
    therapistName: string
  } | null>(null)

  // View and filters
  const [clientView, setClientView] = useState<ClientView>('waiting')
  const [filterVirtualOnly, setFilterVirtualOnly] = useState(false)
  const [filterTimePreference, setFilterTimePreference] = useState<FilterTimePreference>('all')
  const [sortBy, setSortBy] = useState<SortOption>('priority')

  // Get waiting clients count
  const waitingCount = useMemo(
    () => clients.filter((c) => c.status === 'waiting').length,
    [clients]
  )

  // Get active clients count
  const activeCount = useMemo(
    () => clients.filter((c) => c.status === 'in_treatment').length,
    [clients]
  )

  // Get active clients with follow-up info
  const activeClientsWithFollowUp = useMemo(() => {
    return ClientManager.getActiveClientsByFollowUpUrgency(clients, sessions, currentDay)
  }, [clients, sessions, currentDay])

  // Count urgent (overdue or due soon)
  const urgentCount = useMemo(() => {
    return activeClientsWithFollowUp.filter(
      ({ followUp }) => followUp.isOverdue || (followUp.daysUntilDue !== null && followUp.daysUntilDue <= 2)
    ).length
  }, [activeClientsWithFollowUp])

  // Filter and sort clients based on view
  const displayClients = useMemo(() => {
    let filtered: Array<{ client: Client; followUp: FollowUpInfo | null }> = []

    if (clientView === 'waiting') {
      filtered = clients
        .filter((c) => c.status === 'waiting')
        .map((client) => ({ client, followUp: null }))
    } else if (clientView === 'active') {
      filtered = activeClientsWithFollowUp
    } else {
      // 'all' - combine waiting and active
      const waiting = clients
        .filter((c) => c.status === 'waiting')
        .map((client) => ({ client, followUp: null }))
      filtered = [...activeClientsWithFollowUp, ...waiting]
    }

    // Apply filters
    if (filterVirtualOnly) {
      filtered = filtered.filter(({ client }) => client.prefersVirtual)
    }
    if (filterTimePreference !== 'all') {
      filtered = filtered.filter(
        ({ client }) => client.preferredTime === filterTimePreference || client.preferredTime === 'any'
      )
    }

    // Sort
    switch (sortBy) {
      case 'priority':
        // Waiting clients: use priority. Active clients: urgency already sorted
        if (clientView === 'waiting') {
          const waitingClients = filtered.map(({ client }) => client)
          const prioritized = ClientManager.getWaitingClientsPrioritized(waitingClients)
          filtered = prioritized.map((client) => ({ client, followUp: null }))
        }
        break
      case 'urgency':
        // Already sorted by urgency for active clients
        break
      case 'arrival':
        filtered = [...filtered].sort((a, b) => a.client.arrivalDay - b.client.arrivalDay)
        break
      case 'name':
        filtered = [...filtered].sort((a, b) => a.client.displayName.localeCompare(b.client.displayName))
        break
    }

    return filtered
  }, [clients, clientView, activeClientsWithFollowUp, filterVirtualOnly, filterTimePreference, sortBy])

  // Handle client selection
  const handleSelectClient = useCallback(
    (client: Client) => {
      setSelectedClient(client)
      // Auto-select assigned therapist for active clients
      if (client.status === 'in_treatment' && client.assignedTherapistId) {
        const assignedTherapist = therapists.find((t) => t.id === client.assignedTherapistId)
        setSelectedTherapist(assignedTherapist ?? null)
      } else {
        setSelectedTherapist(null)
      }
      setPendingBooking(null)
    },
    [therapists]
  )

  // Handle therapist selection
  const handleSelectTherapist = useCallback((therapist: Therapist) => {
    setSelectedTherapist(therapist)
    setPendingBooking(null)
  }, [])

  // Handle slot selection
  const handleSelectSlot = useCallback(
    (slot: MatchingSlotInfo, duration: SessionDuration, isVirtual: boolean) => {
      setPendingBooking({ slot, duration, isVirtual })
    },
    []
  )

  // Handle booking confirmation
  const handleConfirmBooking = useCallback(() => {
    // Validate preconditions and show error if not met
    if (!selectedClient) {
      setBookingFeedback({
        type: 'error',
        message: 'No client selected',
        clientName: 'Unknown',
        therapistName: 'Unknown',
      })
      setTimeout(() => setBookingFeedback(null), 4000)
      return
    }

    if (!selectedTherapist) {
      setBookingFeedback({
        type: 'error',
        message: 'No therapist selected',
        clientName: selectedClient.displayName,
        therapistName: 'Unknown',
      })
      setTimeout(() => setBookingFeedback(null), 4000)
      return
    }

    if (!pendingBooking) {
      setBookingFeedback({
        type: 'error',
        message: 'No time slot selected',
        clientName: selectedClient.displayName,
        therapistName: selectedTherapist.displayName,
      })
      setTimeout(() => setBookingFeedback(null), 4000)
      return
    }

    const clientName = selectedClient.displayName
    const therapistName = selectedTherapist.displayName

    let bookingSucceeded = false
    let errorMessage: string | undefined

    try {
      // Call the booking function and check result
      const result = onBook({
        clientId: selectedClient.id,
        therapistId: selectedTherapist.id,
        day: pendingBooking.slot.day,
        hour: pendingBooking.slot.hour,
        duration: pendingBooking.duration,
        isVirtual: pendingBooking.isVirtual,
      })

      // Handle result (could be void for backwards compatibility)
      bookingSucceeded = result === undefined || result.success
      errorMessage = result === undefined ? undefined : result.error
    } catch (error) {
      console.error('[BookingDashboard] Booking threw an error', error)
      bookingSucceeded = false
      errorMessage = error instanceof Error ? error.message : 'Booking failed due to an unexpected error.'
    }

    if (bookingSucceeded) {
      // Show success feedback
      setBookingFeedback({
        type: 'success',
        message: `Session booked for Day ${pendingBooking.slot.day} at ${ScheduleManager.formatHour(pendingBooking.slot.hour)}`,
        clientName,
        therapistName,
      })

      // Reset state only on success
      setSelectedClient(null)
      setSelectedTherapist(null)
      setPendingBooking(null)
    } else {
      // Show error feedback
      setBookingFeedback({
        type: 'error',
        message: errorMessage || 'Booking failed. Please try again.',
        clientName,
        therapistName,
      })
    }

    // Auto-clear feedback after 4 seconds
    setTimeout(() => setBookingFeedback(null), 4000)
  }, [selectedClient, selectedTherapist, pendingBooking, onBook])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedClient(null)
    setSelectedTherapist(null)
    setPendingBooking(null)
  }, [])

  // Get follow-up info for selected client
  const selectedClientFollowUp = useMemo(() => {
    if (!selectedClient || selectedClient.status !== 'in_treatment') return null
    return ClientManager.getFollowUpInfo(selectedClient, sessions, currentDay)
  }, [selectedClient, sessions, currentDay])

  return (
    <div className={cn('flex gap-4 h-full', className)}>
      {/* Left panel: Client list */}
      <div className="w-80 shrink-0 flex flex-col">
        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
          <button
            onClick={() => setClientView('waiting')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              clientView === 'waiting'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Waiting
            <Badge variant="default" size="sm">
              {waitingCount}
            </Badge>
          </button>
          <button
            onClick={() => setClientView('active')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              clientView === 'active'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Active
            <Badge variant={urgentCount > 0 ? 'warning' : 'default'} size="sm">
              {activeCount}
            </Badge>
          </button>
        </div>

        {/* Urgent follow-ups alert */}
        {clientView === 'active' && urgentCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{urgentCount} client{urgentCount > 1 ? 's' : ''} need follow-up</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setFilterVirtualOnly(!filterVirtualOnly)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors',
              filterVirtualOnly
                ? 'bg-info/15 text-info border-info/30'
                : 'border-border hover:border-primary/50'
            )}
          >
            <Video className="w-3 h-3" />
            Virtual
          </button>

          <select
            value={filterTimePreference}
            onChange={(e) => setFilterTimePreference(e.target.value as FilterTimePreference)}
            className="text-xs px-2 py-1 rounded-full border border-border bg-background"
          >
            <option value="all">All Times</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs px-2 py-1 rounded-full border border-border bg-background"
          >
            <option value="priority">Priority</option>
            {clientView !== 'waiting' && <option value="urgency">Urgency</option>}
            <option value="arrival">Arrival</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {displayClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {clientView === 'waiting' ? 'No waiting clients' : 'No active clients'}
              </p>
            </div>
          ) : (
            displayClients.map(({ client, followUp }) => {
              const status = followUp ? getFollowUpStatus(followUp, currentDay) : null
              return (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={cn(
                    'cursor-pointer rounded-lg transition-all border border-transparent',
                    selectedClient?.id === client.id && 'ring-2 ring-primary',
                    status?.urgent && 'border-warning/50'
                  )}
                >
                  <ClientCard client={client} compact />
                  {/* Follow-up status row for active clients */}
                  {followUp && status && (
                    <div
                      className={cn(
                        'flex items-center justify-between px-3 py-1.5 text-xs border-t border-border/50 rounded-b-lg',
                        status.variant === 'error' && 'bg-error/10',
                        status.variant === 'warning' && 'bg-warning/10',
                        status.variant === 'success' && 'bg-success/10',
                        status.variant === 'info' && 'bg-info/10'
                      )}
                    >
                      <span className="text-muted-foreground">
                        {followUp.remainingSessions}/{client.sessionsRequired} sessions
                      </span>
                      <Badge
                        variant={status.variant}
                        size="sm"
                        className={cn(status.urgent && 'animate-pulse')}
                      >
                        {status.urgent && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {status.label}
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel: Scheduling area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Booking feedback */}
        {bookingFeedback && (
          <div
            className={cn(
              'flex items-center gap-3 p-3 mb-4 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300',
              bookingFeedback.type === 'success'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-error/10 border-error/30 text-error'
            )}
          >
            {bookingFeedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-medium">
                {bookingFeedback.type === 'success' ? 'Booking Confirmed' : 'Booking Failed'}
              </div>
              <div className="text-sm opacity-90">
                {bookingFeedback.clientName} with {bookingFeedback.therapistName} — {bookingFeedback.message}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBookingFeedback(null)}
              className="text-current hover:bg-current/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {selectedClient ? (
          <>
            {/* Client summary */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <ClientPreferenceSummary client={selectedClient} />
                {/* Follow-up info for active clients */}
                {selectedClientFollowUp && (
                  <Card className="mt-3 p-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Follow-up Status</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>
                          {selectedClientFollowUp.lastSessionDay
                            ? `Last: Day ${selectedClientFollowUp.lastSessionDay}`
                            : 'No sessions yet'}
                        </span>
                        <span>
                          Frequency: {FREQUENCY_DAYS[selectedClient.preferredFrequency] || 'N/A'} days
                        </span>
                        <span>
                          Remaining: {selectedClientFollowUp.remainingSessions} sessions
                        </span>
                      </div>
                      {(() => {
                        const status = getFollowUpStatus(selectedClientFollowUp, currentDay)
                        return (
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        )
                      })()}
                    </div>
                  </Card>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="ml-2">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Therapist selection */}
            <TherapistMatchList
              client={selectedClient}
              therapists={therapists}
              selectedTherapistId={selectedTherapist?.id}
              onSelect={handleSelectTherapist}
              className="mb-4"
            />

            {/* Time slots */}
            {selectedTherapist && (
              <MatchingSlotsList
                client={selectedClient}
                therapist={selectedTherapist}
                schedule={schedule}
                sessions={sessions}
                currentBuilding={currentBuilding}
                telehealthUnlocked={telehealthUnlocked}
                currentDay={currentDay}
                onSelectSlot={handleSelectSlot}
                className="flex-1 overflow-y-auto"
              />
            )}

            {/* Booking confirmation */}
            {pendingBooking && (
              <Card className="mt-4 p-4 border-success/30 bg-success/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <div className="font-medium">
                        {selectedClient.status === 'in_treatment' ? 'Book Follow-up' : 'Book Initial Session'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{selectedClient.displayName}</span>
                        <span className="text-muted-foreground/50">with</span>
                        <span>{selectedTherapist?.displayName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        Day {pendingBooking.slot.day}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        {ScheduleManager.formatHour(pendingBooking.slot.hour)}
                      </span>
                      <Badge variant={pendingBooking.isVirtual ? 'info' : 'warning'} size="sm">
                        {pendingBooking.isVirtual ? (
                          <>
                            <Video className="w-3 h-3 mr-1" />
                            Virtual
                          </>
                        ) : (
                          <>
                            <BuildingIcon className="w-3 h-3 mr-1" />
                            Office
                          </>
                        )}
                      </Badge>
                      <span className="text-muted-foreground">{pendingBooking.duration}min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPendingBooking(null)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleConfirmBooking}>
                      Confirm Booking
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : (
          // Show schedule when no client selected
          <ScheduleView
            currentDay={currentDay}
            currentHour={currentHour}
            schedule={schedule}
            sessions={sessions}
            therapists={therapists}
            currentBuilding={currentBuilding}
            telehealthUnlocked={telehealthUnlocked}
          />
        )}
      </div>
    </div>
  )
}
