import { useState, useCallback, useMemo } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { useTrainingProcessor } from '@/hooks'
import { cn } from '@/lib/utils'
import { ScheduleView } from './ScheduleView'
import { WaitingListPanel } from './WaitingListPanel'
import { BookingDashboard } from './BookingDashboard'
import { TherapistPanel } from './TherapistPanel'
import { EconomyPanel } from './EconomyPanel'
import { OfficePanel } from './OfficePanel'
import { InsurancePanelView } from './InsurancePanelView'
import { RandomEventModal } from './RandomEventModal'
import { DecisionEventModal } from './DecisionEventModal'
import { BookingModal } from './BookingModal'
import { TrainingModal } from './TrainingModal'
import { BUILDINGS, getBuilding, INSURANCE_PANELS } from '@/data'
import { InsuranceManager } from '@/core/insurance'
import { OfficeManager, OFFICE_CONFIG } from '@/core/office'
import { ScheduleManager } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import type { Session, RandomEvent, DecisionEvent } from '@/core/types'
import {
  Calendar,
  CalendarPlus,
  Users,
  UserCheck,
  DollarSign,
  Building2,
  Shield,
} from 'lucide-react'
import styles from './GameView.module.css'

type TabId = 'schedule' | 'booking' | 'clients' | 'team' | 'finances' | 'office' | 'insurance'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'booking', label: 'Booking', icon: <CalendarPlus className="w-4 h-4" /> },
  { id: 'clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'finances', label: 'Finances', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'office', label: 'Office', icon: <Building2 className="w-4 h-4" /> },
  { id: 'insurance', label: 'Insurance', icon: <Shield className="w-4 h-4" /> },
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
  const [activeTab, setActiveTab] = useState<TabId>('schedule')
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null)
  const [bookingSlot, setBookingSlot] = useState<{ day: number; hour: number; therapistId: string } | null>(null)
  const [trainingTherapistId, setTrainingTherapistId] = useState<string | null>(null)

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
  } = useGameStore()

  // Store actions
  const {
    addTherapist,
    updateClient,
    removeFromWaitingList,
    addSession,
    updateSchedule,
    removeMoney,
    setBuilding,
    unlockTelehealth,
    addInsurancePanel,
    removeInsurancePanel,
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
      addNotification({
        type: 'info',
        title: 'Session Details',
        message: `${session.therapistName} with ${session.clientName}`,
      })
    },
    [addNotification]
  )

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

      // Check if therapist slot is available (covers multi-hour sessions)
      const therapistSlotAvailable = ScheduleManager.isSlotAvailable(
        freshSchedule,
        params.therapistId,
        params.day,
        params.hour,
        params.duration
      )

      if (!therapistSlotAvailable) {
        console.error(`[Booking] Slot not available: Day ${params.day}, Hour ${params.hour}`)
        addNotification({
          type: 'error',
          title: 'Booking Failed',
          message: 'This time slot is already booked. Please select another.',
        })
        return { success: false, error: 'Slot already booked' }
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
        payment: client.sessionRate,
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
      if (removeMoney(cost, 'Hiring bonus')) {
        addTherapist(therapist)
        addNotification({
          type: 'success',
          title: 'Therapist Hired',
          message: `${therapist.displayName} has joined your practice!`,
        })
      }
    },
    [removeMoney, addTherapist, addNotification]
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
      case 'schedule':
        return (
          <ScheduleView
            currentDay={currentDay}
            currentHour={currentHour}
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

      case 'clients':
        return (
          <WaitingListPanel
            clients={clients}
            therapists={therapists}
          />
        )

      case 'team':
        return (
          <TherapistPanel
            therapists={therapists}
            activeTrainings={activeTrainings}
            currentBalance={balance}
            practiceLevel={practiceLevel}
            onHire={handleHire}
            onStartTraining={(therapistId) => setTrainingTherapistId(therapistId)}
          />
        )

      case 'finances':
        return (
          <EconomyPanel
            balance={balance}
            pendingClaims={pendingClaims}
            therapists={therapists}
            transactions={transactionHistory.slice(-20)}
            currentBuildingId={currentBuildingId}
            currentDay={currentDay}
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

      case 'insurance':
        return (
          <InsurancePanelView
            panels={INSURANCE_PANELS}
            activePanels={activePanels}
            pendingApplications={[]}
            pendingClaims={pendingClaims}
            reputation={reputation}
            currentBalance={balance}
            insuranceMultiplier={insuranceMultiplier}
            currentDay={currentDay}
            onApply={handleApplyToPanel}
            onDrop={handleDropPanel}
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
