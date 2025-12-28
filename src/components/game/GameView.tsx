import { useState, useCallback, useMemo } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { useTrainingProcessor } from '@/hooks'
import { cn } from '@/lib/utils'
import { ScheduleView } from './ScheduleView'
import { BookingDashboard } from './BookingDashboard'
import { PeoplePanel } from './PeoplePanel'
import { PracticePanel } from './PracticePanel'
import { OfficePanel } from './OfficePanel'
import { RandomEventModal } from './RandomEventModal'
import { DecisionEventModal } from './DecisionEventModal'
import { BookingModal } from './BookingModal'
import { ManageBookingModal } from './ManageBookingModal'
import { TrainingModal } from './TrainingModal'
import { BUILDINGS, getBuilding } from '@/data'
import { InsuranceManager } from '@/core/insurance'
import { INSURANCE_PANELS } from '@/data'
import { OfficeManager, OFFICE_CONFIG } from '@/core/office'
import { ScheduleManager } from '@/core/schedule'
import { ClientManager } from '@/core/clients'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import type { Session, RandomEvent, DecisionEvent } from '@/core/types'
import { getMilestoneConfig, getPracticeLevelConfig } from '@/core/types'
import {
  Calendar,
  CalendarPlus,
  Users,
  Briefcase,
  Building2,
} from 'lucide-react'
import styles from './GameView.module.css'

type TabId = 'today' | 'booking' | 'people' | 'practice' | 'office'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'today', label: 'Today', icon: <Calendar className="w-4 h-4" /> },
  { id: 'booking', label: 'Book', icon: <CalendarPlus className="w-4 h-4" /> },
  { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
  { id: 'practice', label: 'Practice', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'office', label: 'Office', icon: <Building2 className="w-4 h-4" /> },
]

export interface GameViewProps {
  /** Currently active random event */
  activeRandomEvent?: RandomEvent | null
  /** Random event choice handler */
  onRandomEventChoice?: (choiceIndex: number) => void
  /** Currently active decision event */
  activeDecisionEvent?: DecisionEvent | null
  /** Session for decision event */
  decisionEventSession?: Session | null
  /** Decision event choice handler */
  onDecisionChoice?: (choiceIndex: number) => void
  /** Additional class name */
  className?: string
}

export function GameView({
  activeRandomEvent,
  onRandomEventChoice,
  activeDecisionEvent,
  decisionEventSession,
  onDecisionChoice,
  className,
}: GameViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('today')
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null)
  const [bookingSlot, setBookingSlot] = useState<{ day: number; hour: number; therapistId: string } | null>(null)
  const [trainingTherapistId, setTrainingTherapistId] = useState<string | null>(null)
  const [manageSessionId, setManageSessionId] = useState<string | null>(null)

  // Store state
  const {
    currentDay,
    currentHour,
    currentMinute,
    balance,
    reputation,
    practiceLevel,
    therapists,
    clients,
    sessions,
    schedule,
    waitingList,
    activeTrainings,
    transactionHistory,
    pendingClaims,
    currentBuildingId,
    telehealthUnlocked,
    activePanels,
    insuranceMultiplier,
    hiringCapacityBonus,
    updateTherapistWorkSchedule,
  } = useGameStore()

  // Store actions
  const {
    addTherapist,
    updateClient,
    removeFromWaitingList,
    addSession,
    updateSchedule,
    cancelSession,
    rescheduleSession,
    removeMoney,
    setBuilding,
    unlockTelehealth,
    addInsurancePanel,
    removeInsurancePanel,
    checkAndAwardMilestones,
  } = useGameStore()

  const { addNotification } = useUIStore()

  // Training enrollment (daily progression is handled by App-level processor)
  const { startTraining } = useTrainingProcessor({ enabled: false })

  // Get current building
  const currentBuilding = useMemo(() => {
    return getBuilding(currentBuildingId) || BUILDINGS.starter_suite
  }, [currentBuildingId])

  // Get waiting list clients
  const waitingClients = useMemo(() => {
    return waitingList
      .map((id) => clients.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
  }, [waitingList, clients])

  // Handle slot click for booking
  const handleSlotClick = useCallback(
    (day: number, hour: number, therapistId: string) => {
      setBookingSlot({ day, hour, therapistId })
    },
    []
  )

  // Handle session click
  const handleSessionClick = useCallback(
    (session: Session) => {
      setManageSessionId(session.id)
    },
    []
  )

  const manageSession = useMemo(() => {
    if (!manageSessionId) return null
    return sessions.find((s) => s.id === manageSessionId) ?? null
  }, [manageSessionId, sessions])

  // Handle booking confirmation from modal or dashboard
  // IMPORTANT: Uses getState() to get fresh data, avoiding stale closure issues
  const handleBookingConfirmFromModal = useCallback(
    (params: {
      clientId: string
      therapistId: string
      day: number
      hour: number
      duration: 50 | 80 | 180
      isVirtual: boolean
    }): { success: boolean; error?: string } => {
      // Get fresh state to avoid stale closure issues
      const {
        clients: freshClients,
        therapists: freshTherapists,
        schedule: freshSchedule,
        sessions: freshSessions,
      } = useGameStore.getState()

      const client = freshClients.find((c) => c.id === params.clientId)
      const therapist = freshTherapists.find((t) => t.id === params.therapistId)

      // Validate client exists
      if (!client) {
        console.error(`[Booking] Client ${params.clientId} not found`)
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: 'Client not found. Please try again.',
        })
        return { success: false, error: 'Client not found' }
      }

      // Validate therapist exists
      if (!therapist) {
        console.error(`[Booking] Therapist ${params.therapistId} not found`)
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: 'Therapist not found. Please try again.',
        })
        return { success: false, error: 'Therapist not found' }
      }

      // Check if therapist slot is available (covers multi-hour sessions + work hours + lunch breaks)
      const therapistSlotAvailable = ScheduleManager.isSlotAvailable(
        freshSchedule,
        params.therapistId,
        params.day,
        params.hour,
        params.duration,
        therapist
      )

      if (!therapistSlotAvailable) {
        console.error(`[Booking] Slot not available: Day ${params.day}, Hour ${params.hour}`)
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: 'This time slot is not available. The therapist may be on break or outside work hours.',
        })
        return { success: false, error: 'Slot not available' }
      }

      // Check if client already has an overlapping session
      const clientConflict = ScheduleManager.clientHasConflictingSession(
        freshSessions,
        params.clientId,
        params.day,
        params.hour,
        params.duration
      )

      if (clientConflict) {
        console.error(`[Booking] Client already has an overlapping session at this time`)
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: 'Client already has a session scheduled at this time.',
        })
        return { success: false, error: 'Client has conflicting session' }
      }

      // Check room capacity / telehealth availability for the selected session type
      const { currentBuildingId: freshBuildingId, telehealthUnlocked: freshTelehealthUnlocked } =
        useGameStore.getState()
      const freshBuilding = getBuilding(freshBuildingId) || BUILDINGS.starter_suite

      const typeCheck = canBookSessionType({
        building: freshBuilding,
        sessions: freshSessions,
        telehealthUnlocked: freshTelehealthUnlocked,
        isVirtual: params.isVirtual,
        day: params.day,
        hour: params.hour,
        durationMinutes: params.duration,
      })

      if (!typeCheck.canBook) {
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: typeCheck.reason,
        })
        return { success: false, error: typeCheck.reason }
      }

      // Create the session
      const now = useGameStore.getState()
      const timeCheck = ScheduleManager.validateNotInPast(
        { day: now.currentDay, hour: now.currentHour, minute: now.currentMinute },
        params.day,
        params.hour
      )
      if (!timeCheck.valid) {
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: timeCheck.reason || 'Cannot schedule a session in the past.',
        })
        return { success: false, error: timeCheck.reason || 'Session time is in the past' }
      }

      // CRIT-006 fix: Validate therapist can serve this client
      const validationResult = ClientManager.canTherapistServeClient(client, therapist)
      if (!validationResult.valid) {
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: validationResult.reason || 'Therapist cannot serve this client.',
        })
        return { success: false, error: validationResult.reason || 'Therapist qualification mismatch' }
      }

      // CRIT-005 fix: Apply duration multiplier for payment calculation
      const payment = ScheduleManager.calculateSessionPayment(client.sessionRate, params.duration)

      const session: Session = {
        id: crypto.randomUUID(),
        therapistId: therapist.id,
        clientId: client.id,
        sessionType: 'clinical',
        isVirtual: params.isVirtual,
        isInsurance: !client.isPrivatePay,
        scheduledDay: params.day,
        scheduledHour: params.hour,
        durationMinutes: params.duration,
        status: 'scheduled',
        progress: 0,
        quality: 0.5,
        qualityModifiers: [],
        payment,
        energyCost: 15,
        xpGained: 0,
        decisionsMade: [],
        therapistName: therapist.displayName,
        clientName: client.displayName,
      }

      addSession(session)

      // Update the schedule with the new session
      const newSchedule = ScheduleManager.addToSchedule(freshSchedule, session)
      updateSchedule(newSchedule)

      // Only remove from waiting list if client was waiting (not already in treatment)
      if (client.status === 'waiting') {
        removeFromWaitingList(params.clientId)
      }

      // Update client status
      updateClient(params.clientId, {
        status: 'in_treatment',
        assignedTherapistId: therapist.id,
      })

      addNotification({
        type: 'success',
        title: 'Session Booked',
        message: `${client.displayName} scheduled with ${therapist.displayName}`,
      })

      setBookingSlot(null)
      return { success: true }
    },
    [addSession, updateSchedule, removeFromWaitingList, updateClient, addNotification]
  )

  // Handle therapist hire
  const handleHire = useCallback(
    (therapist: typeof therapists[0], cost: number) => {
      // Check hiring capacity
      const levelConfig = getPracticeLevelConfig(practiceLevel)
      const maxTherapists = levelConfig.staffCap + hiringCapacityBonus

      if (therapists.length >= maxTherapists) {
        addNotification({
          type: 'error',
          title: 'Cannot Hire',
          message: `Staff capacity reached (${therapists.length}/${maxTherapists}). Increase reputation or complete Leadership training.`,
        })
        return
      }

      if (removeMoney(cost, 'Hiring bonus')) {
        addTherapist(therapist)
        addNotification({
          type: 'success',
          title: 'Therapist Hired',
          message: `${therapist.displayName} has joined your practice!`,
        })

        // Check for milestone achievements (e.g., first_employee_hired)
        const awarded = checkAndAwardMilestones()
        awarded.forEach((milestoneId) => {
          const config = getMilestoneConfig(milestoneId)
          if (config) {
            addNotification({
              type: 'success',
              title: 'Milestone Achieved!',
              message: `${config.name}: +${config.reputationBonus} reputation`,
            })
          }
        })
      }
    },
    [removeMoney, addTherapist, addNotification, checkAndAwardMilestones, practiceLevel, hiringCapacityBonus, therapists.length]
  )

  // Handle building upgrade
  const handleUpgradeBuilding = useCallback(
    (buildingId: string) => {
      const targetBuilding = getBuilding(buildingId)
      if (!targetBuilding) return

      const result = OfficeManager.canUpgradeBuilding(
        currentBuilding,
        targetBuilding,
        balance,
        practiceLevel
      )

      if (result.canUpgrade) {
        if (removeMoney(targetBuilding.upgradeCost, 'Office upgrade')) {
          setBuilding(buildingId)
          addNotification({
            type: 'success',
            title: 'Office Upgraded',
            message: `Moved to ${targetBuilding.name}!`,
          })
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Cannot Upgrade',
          message: result.reason || 'Unknown error',
        })
      }
    },
    [currentBuilding, balance, practiceLevel, removeMoney, setBuilding, addNotification]
  )

  // Handle telehealth unlock
  const handleUnlockTelehealth = useCallback(() => {
    const result = OfficeManager.canUnlockTelehealth(balance, telehealthUnlocked)
    if (result.canUnlock) {
      if (removeMoney(OFFICE_CONFIG.TELEHEALTH_UNLOCK_COST, 'Telehealth setup')) {
        unlockTelehealth()
        addNotification({
          type: 'success',
          title: 'Telehealth Unlocked',
          message: 'You can now offer virtual sessions!',
        })
      }
    } else {
      addNotification({
        type: 'error',
        title: 'Cannot Unlock',
        message: result.reason || 'Unknown error',
      })
    }
  }, [balance, telehealthUnlocked, removeMoney, unlockTelehealth, addNotification])

  // Handle insurance panel application
  const handleApplyToPanel = useCallback(
    (panelId: typeof activePanels[0]) => {
      const panel = INSURANCE_PANELS[panelId]
      if (!panel) return

      const result = InsuranceManager.applyToPanel(
        panel,
        reputation,
        balance,
        activePanels,
        [], // No pending applications for now
        Date.now()
      )

      if (result.success) {
        if (result.applicationFee && result.applicationFee > 0) {
          removeMoney(result.applicationFee, 'Insurance application')
        }

        if (result.accepted) {
          addInsurancePanel(panelId)
          addNotification({
            type: 'success',
            title: 'Panel Accepted',
            message: `You are now on the ${panel.name} panel!`,
          })
        } else {
          addNotification({
            type: 'warning',
            title: 'Application Denied',
            message: `${panel.name} did not accept your application.`,
          })
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Cannot Apply',
          message: result.reason || 'Unknown error',
        })
      }
    },
    [reputation, balance, activePanels, removeMoney, addInsurancePanel, addNotification]
  )

  // Handle dropping insurance panel
  const handleDropPanel = useCallback(
    (panelId: typeof activePanels[0]) => {
      const panel = INSURANCE_PANELS[panelId]
      if (!panel) return

      removeInsurancePanel(panelId)
      addNotification({
        type: 'info',
        title: 'Panel Dropped',
        message: `You are no longer on the ${panel.name} panel.`,
      })
    },
    [removeInsurancePanel, addNotification]
  )

  // Render active tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <ScheduleView
            currentDay={currentDay}
            currentHour={currentHour}
            currentMinute={currentMinute}
            schedule={schedule}
            sessions={sessions}
            therapists={therapists}
            currentBuilding={currentBuilding}
            telehealthUnlocked={telehealthUnlocked}
            selectedTherapistId={selectedTherapistId || undefined}
            onTherapistSelect={setSelectedTherapistId}
            onSlotClick={handleSlotClick}
            onSessionClick={handleSessionClick}
          />
        )

      case 'booking':
        return (
          <BookingDashboard
            clients={clients}
            therapists={therapists}
            sessions={sessions}
            schedule={schedule}
            currentBuilding={currentBuilding}
            telehealthUnlocked={telehealthUnlocked}
            currentDay={currentDay}
            currentHour={currentHour}
            currentMinute={currentMinute}
            onBook={handleBookingConfirmFromModal}
          />
        )

      case 'people': {
        const levelConfig = getPracticeLevelConfig(practiceLevel)
        const maxTherapists = levelConfig.staffCap + hiringCapacityBonus
        return (
          <PeoplePanel
            clients={clients}
            therapists={therapists}
            activeTrainings={activeTrainings}
            sessions={sessions}
            schedule={schedule}
            currentDay={currentDay}
            currentBalance={balance}
            practiceLevel={practiceLevel}
            maxTherapists={maxTherapists}
            onHire={handleHire}
            onStartTraining={(therapistId) => setTrainingTherapistId(therapistId)}
            onUpdateSchedule={updateTherapistWorkSchedule}
          />
        )
      }

      case 'practice':
        return (
          <PracticePanel
            balance={balance}
            pendingClaims={pendingClaims}
            therapists={therapists}
            transactions={transactionHistory.slice(-20)}
            sessions={sessions}
            currentBuildingId={currentBuildingId}
            currentDay={currentDay}
            activePanels={activePanels}
            reputation={reputation}
            insuranceMultiplier={insuranceMultiplier}
            onApplyToPanel={handleApplyToPanel}
            onDropPanel={handleDropPanel}
          />
        )

      case 'office':
        return (
          <OfficePanel
            currentBuilding={currentBuilding}
            availableBuildings={Object.values(BUILDINGS)}
            sessions={sessions}
            currentDay={currentDay}
            currentBalance={balance}
            practiceLevel={practiceLevel}
            telehealthUnlocked={telehealthUnlocked}
            onUpgrade={handleUpgradeBuilding}
            onUnlockTelehealth={handleUnlockTelehealth}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={cn(styles.container, className)}>
      {/* Tab navigation */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            className={cn(styles.tab, activeTab === tab.id && styles.tabActive)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>{renderContent()}</div>

      {/* Random Event Modal */}
      {activeRandomEvent && onRandomEventChoice && (
        <RandomEventModal
          event={activeRandomEvent}
          currentBalance={balance}
          onChoice={onRandomEventChoice}
        />
      )}

      {/* Decision Event Modal */}
      {activeDecisionEvent && decisionEventSession && onDecisionChoice && (
        <DecisionEventModal
          event={activeDecisionEvent}
          sessionInfo={{
            therapistName: decisionEventSession.therapistName,
            clientName: decisionEventSession.clientName,
            sessionProgress: decisionEventSession.progress,
          }}
          onChoice={onDecisionChoice}
        />
      )}

      {/* Booking Modal */}
      {bookingSlot && (
        <BookingModal
          open={true}
          onClose={() => setBookingSlot(null)}
          clients={waitingClients}
          therapists={therapists}
          schedule={schedule}
          sessions={sessions}
          currentBuilding={currentBuilding}
          telehealthUnlocked={telehealthUnlocked}
          currentDay={currentDay}
          currentHour={currentHour}
          currentMinute={currentMinute}
          selectedSlot={bookingSlot}
          onBook={handleBookingConfirmFromModal}
        />
      )}

      {/* Manage Booking Modal */}
      {manageSession && (
        <ManageBookingModal
          open={true}
          onClose={() => setManageSessionId(null)}
          session={manageSession}
          clients={clients}
          therapists={therapists}
          sessions={sessions}
          currentBuilding={currentBuilding}
          telehealthUnlocked={telehealthUnlocked}
          currentDay={currentDay}
          currentHour={currentHour}
          currentMinute={currentMinute}
          onCancel={(sessionId) => {
            const result = cancelSession(sessionId)
            if (!result?.success) {
              addNotification({
                type: 'error',
                title: 'Cancel Failed',
                message: result?.error || 'Unable to cancel session.',
              })
              return result
            }

            addNotification({
              type: 'success',
              title: 'Session Cancelled',
              message: 'Booking cancelled successfully.',
            })
            setManageSessionId(null)
            return result
          }}
          onReschedule={(params) => {
            const result = rescheduleSession(params)
            if (!result?.success) {
              addNotification({
                type: 'error',
                title: 'Reschedule Failed',
                message: result?.error || 'Unable to reschedule session.',
              })
              return result
            }

            addNotification({
              type: 'success',
              title: 'Session Rescheduled',
              message: `Moved to Day ${params.day}, ${ScheduleManager.formatHour(params.hour)}`,
            })
            setManageSessionId(null)
            return result
          }}
        />
      )}

      {/* Training Modal */}
      {trainingTherapistId && (
        (() => {
          const therapist = therapists.find((t) => t.id === trainingTherapistId)
          if (!therapist) return null

          return (
            <TrainingModal
              therapist={therapist}
              currentBalance={balance}
              onStartTraining={(therapistId, programId) => {
                startTraining(therapistId, programId)
              }}
              onClose={() => setTrainingTherapistId(null)}
            />
          )
        })()
      )}
    </div>
  )
}
