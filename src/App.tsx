import { useEffect, useCallback, useState, useRef } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { SaveManager } from '@/core/engine'
import { EventManager, EventBus, GameEvents } from '@/core/events'
import { DaySummaryManager, type DaySummary } from '@/core/summary'
import { useGameLoop, useClientSpawning, useTrainingProcessor, useTherapistEnergyProcessor } from '@/hooks'
import { formatTime } from '@/lib/utils'
import { GameLayout, GameView, NewGameModal, DaySummaryModal, TutorialOverlay } from '@/components'
import { getAllRandomEvents, getEligibleDecisionEvents } from '@/data'
import { getSessionReputationDelta, getReputationChangeReason } from '@/core/reputation'
import type { RandomEvent, DecisionEvent, Session, Therapist } from '@/core/types'

function App() {
  // Expose stores in dev for debugging/e2e.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as any).gameStore = useGameStore
    ;(window as any).uiStore = useUIStore
    ;(window as any).EventBus = EventBus
    ;(window as any).GameEvents = GameEvents
  }, [])

  // Game state
  const {
    currentDay,
    therapists,
    eventCooldowns,
    reputation,
  } = useGameStore()

  // Store actions
  const { setGameSpeed, pause, resume, newGame } = useGameStore()
  const { addMoney, removeMoney, addReputation, removeReputation } = useGameStore()
  const { setEventCooldown, addModifier, updateSession, updateTherapist } = useGameStore()

  const addNotification = useUIStore((state) => state.addNotification)

  // Local state for events
  const [activeRandomEvent, setActiveRandomEvent] = useState<RandomEvent | null>(null)
  const [activeDecisionEvent, setActiveDecisionEvent] = useState<DecisionEvent | null>(null)
  const [decisionEventSession, setDecisionEventSession] = useState<Session | null>(null)
  const [activeDaySummary, setActiveDaySummary] = useState<DaySummary | null>(null)
  const [showNewGame, setShowNewGame] = useState(true)
  const [hasStartedGame, setHasStartedGame] = useState(false)

  // Track last day we checked for events
  const lastEventCheckDay = useRef(0)

  // Handle session completion
  const handleSessionComplete = useCallback(
    (session: Session) => {
      // Get fresh state
      const { currentDay: day, currentHour: hour, currentMinute: minute, therapists: freshTherapists } =
        useGameStore.getState()

      // Prevent double-completion
      if (session.status === 'completed') {
        console.warn(`[handleSessionComplete] Session ${session.id} already completed`)
        return
      }

      updateSession(session.id, {
        status: 'completed',
        progress: 1,
        completedAt: { day, hour, minute },
      })

      // Update therapist status and energy
      const therapist = freshTherapists.find((t) => t.id === session.therapistId)
      if (therapist) {
        const newEnergy = Math.max(0, therapist.energy - session.energyCost)

        // Only reset to 'available' if therapist was 'in_session'
        // Preserve other statuses like 'on_break', 'in_training'
        const newStatus = therapist.status === 'in_session' ? 'available' : therapist.status

        updateTherapist(session.therapistId, {
          status: newStatus,
          energy: newEnergy,
          xp: therapist.xp + session.xpGained,
        })

        // Check for burnout
        if (newEnergy <= 10) {
          addNotification({
            type: 'warning',
            title: 'Low Energy',
            message: `${therapist.displayName} is running low on energy!`,
          })
        }
      }

      // Add payment
      addMoney(session.payment, `Session with ${session.clientName}`)

      // Award reputation based on session quality
      const reputationDelta = getSessionReputationDelta(session.quality)
      if (reputationDelta !== 0) {
        const reason = getReputationChangeReason(session.quality)
        if (reputationDelta > 0) {
          addReputation(reputationDelta, reason)
        } else {
          removeReputation(-reputationDelta, reason)
        }
      }

      addNotification({
        type: 'success',
        title: 'Session Completed',
        message: `${session.therapistName} finished session with ${session.clientName}`,
      })

      // Emit event for other systems to react
      EventBus.emit(GameEvents.SESSION_COMPLETED, {
        sessionId: session.id,
        quality: session.quality,
        payment: session.payment,
      })
    },
    [updateSession, updateTherapist, addMoney, removeReputation, addReputation, addNotification]
  )

  // Session callbacks for the game loop
  // IMPORTANT: Use getState() to get fresh state, not closure variables
  const handleSessionStart = useCallback(
    (sessionId: string) => {
      // Get fresh state to avoid stale closure issues
      const freshSessions = useGameStore.getState().sessions
      const session = freshSessions.find((s) => s.id === sessionId)
      if (!session) {
        console.warn(`[handleSessionStart] Session ${sessionId} not found`)
        return
      }

      // Prevent double-starting a session
      if (session.status !== 'scheduled') {
        console.warn(`[handleSessionStart] Session ${sessionId} is already ${session.status}`)
        return
      }

      addNotification({
        type: 'info',
        title: 'Session Started',
        message: `${session.therapistName} is meeting with ${session.clientName}`,
      })

      // Update session status
      updateSession(sessionId, { status: 'in_progress' })

      // Update therapist status
      updateTherapist(session.therapistId, { status: 'in_session' })

      // Emit event for other systems to react
      EventBus.emit(GameEvents.SESSION_STARTED, { sessionId })
    },
    [addNotification, updateSession, updateTherapist]
  )

  const { onTimeAdvance: handleTimeAdvance, recordSessionMinutes } = useTherapistEnergyProcessor({
    enabled: hasStartedGame,
  })

  const handleSessionTick = useCallback(
    (sessionId: string, deltaMinutes: number) => {
      // Get fresh state to avoid stale closure issues
      const { sessions: freshSessions, clients: freshClients } = useGameStore.getState()
      const session = freshSessions.find((s) => s.id === sessionId)

      if (!session) {
        console.warn(`[handleSessionTick] Session ${sessionId} not found`)
        return
      }

      if (session.status !== 'in_progress') {
        // Session not active, skip tick
        return
      }

      // Track how many minutes this therapist spent in-session this tick
      // so energy recovery can apply only to idle minutes.
      const remainingMinutes = Math.max(0, (1 - session.progress) * session.durationMinutes)
      const sessionMinutesThisTick = Math.min(deltaMinutes, remainingMinutes)
      if (sessionMinutesThisTick > 0) {
        recordSessionMinutes(session.therapistId, sessionMinutesThisTick)
      }

      // Update progress
      const progressIncrement = deltaMinutes / session.durationMinutes
      const newProgress = Math.min(1, session.progress + progressIncrement)

      updateSession(sessionId, { progress: newProgress })

      // Check for decision event trigger (mid-session)
      if (newProgress > 0.3 && newProgress < 0.7 && !activeDecisionEvent) {
        const client = freshClients.find((c) => c.id === session.clientId)
        if (!client) return

        const eligibleEvents = getEligibleDecisionEvents(
          client.severity,
          client.conditionCategory
        )

        const check = EventManager.checkDecisionEventTrigger(
          eligibleEvents,
          session.decisionsMade.map((d) => d.eventId),
          {
            clientConditionCategory: client.conditionCategory,
            sessionProgress: newProgress,
            clientSeverity: client.severity,
            currentMinute: Math.floor(newProgress * session.durationMinutes),
            gameSpeed: useGameStore.getState().gameSpeed as 1 | 2 | 3,
          },
          Date.now() + sessionId.charCodeAt(0)
        )

        if (check.shouldTrigger && check.event) {
          setActiveDecisionEvent(check.event)
          setDecisionEventSession(session)
          pause('decision_event')
        }
      }

      // Session completion - get fresh session to ensure we have latest progress
      const latestSession = useGameStore.getState().sessions.find((s) => s.id === sessionId)
      if (latestSession && latestSession.progress >= 1) {
        handleSessionComplete(latestSession)
      }
    },
    [activeDecisionEvent, pause, updateSession, handleSessionComplete, recordSessionMinutes]
  )

  // Initialize game loop
  const { skipToNextSession, getNextSessionTime } = useGameLoop({
    onSessionStart: handleSessionStart,
    onSessionTick: handleSessionTick,
    onTimeAdvance: handleTimeAdvance,
  })

  // Initialize client spawning (runs on day transitions)
  useClientSpawning({
    enabled: hasStartedGame,
    onClientArrived: (clientId, reason) => {
      console.log(`Client ${clientId} arrived: ${reason}`)
    },
    onClientDropped: (clientId, reason) => {
      console.log(`Client ${clientId} dropped: ${reason}`)
    },
  })

  // Initialize training processor (runs on day transitions)
  // startTraining is used by components through their own hook instances
  useTrainingProcessor({
    enabled: hasStartedGame,
    onTrainingCompleted: (completed) => {
      console.log(`Training completed: ${completed.programName} by ${completed.therapistName}`)
    },
  })

  // Subscribe to DAY_ENDED event for day summary
  useEffect(() => {
    if (!hasStartedGame) return

    const unsubscribe = EventBus.on(GameEvents.DAY_ENDED, (data: { dayNumber: number }) => {
      // Get current state for summary calculation
      const state = useGameStore.getState()

      const summary = DaySummaryManager.calculateDaySummary(
        data.dayNumber,
        state.transactionHistory,
        state.sessions,
        state.clients,
        state.therapists,
        state.pendingClaims,
        state.waitingList.length,
        state.activeTrainings.length
      )

      // Use setTimeout to avoid state update during event callback
      setTimeout(() => {
        setActiveDaySummary(summary)
        pause('day_summary')
      }, 0)
    })

    return unsubscribe
  }, [hasStartedGame, pause])

  // Handle day summary continue
  const handleDaySummaryContinue = useCallback(() => {
    setActiveDaySummary(null)
    resume('day_summary')
  }, [resume])

  // Check for random events at day start
  useEffect(() => {
    if (!hasStartedGame) return
    if (currentDay === lastEventCheckDay.current) return
    if (currentDay < 2) return // No events on day 1

    lastEventCheckDay.current = currentDay

    // Get eligible events based on context
    const allEvents = getAllRandomEvents()
    const playerTherapist = therapists.find((t) => t.isPlayer)
    const context = {
      reputation,
      therapistCount: therapists.length,
      currentDay,
      playerEnergy: playerTherapist?.energy ?? 100,
    }

    const check = EventManager.checkRandomEventTrigger(
      currentDay,
      allEvents,
      eventCooldowns,
      context,
      Date.now()
    )

    if (check.shouldTrigger && check.event) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setActiveRandomEvent(check.event)
        pause('random_event')
      }, 0)
    }
  }, [currentDay, hasStartedGame, reputation, therapists, eventCooldowns, pause])

  // Handle random event choice
  const handleRandomEventChoice = useCallback(
    (choiceIndex: number) => {
      if (!activeRandomEvent) return

      const result = EventManager.applyRandomEventChoice(
        activeRandomEvent,
        choiceIndex,
        currentDay
      )

      // Apply effects
      if (result.moneyChange !== 0) {
        if (result.moneyChange > 0) {
          addMoney(result.moneyChange, activeRandomEvent.title)
        } else {
          removeMoney(-result.moneyChange, activeRandomEvent.title)
        }
      }

      if (result.reputationChange !== 0) {
        if (result.reputationChange > 0) {
          addReputation(result.reputationChange, activeRandomEvent.title)
        } else {
          removeReputation(-result.reputationChange, activeRandomEvent.title)
        }
      }

      if (result.modifierApplied) {
        addModifier(result.modifierApplied)
        addNotification({
          type: 'info',
          title: 'Modifier Active',
          message: `${result.modifierApplied.name} for ${result.modifierApplied.duration} days`,
        })
      }

      // Set cooldown
      const cooldowns = EventManager.updateCooldowns(
        eventCooldowns,
        activeRandomEvent.id,
        currentDay,
        activeRandomEvent.cooldownDays
      )
      Object.entries(cooldowns).forEach(([eventId, expires]) => {
        setEventCooldown(eventId, expires)
      })

      setActiveRandomEvent(null)
      resume('random_event')
    },
    [
      activeRandomEvent,
      currentDay,
      eventCooldowns,
      addMoney,
      removeMoney,
      addReputation,
      removeReputation,
      addModifier,
      setEventCooldown,
      addNotification,
      resume,
    ]
  )

  // Handle decision event choice
  const handleDecisionChoice = useCallback(
    (choiceIndex: number) => {
      if (!activeDecisionEvent || !decisionEventSession) return

      const result = EventManager.applyDecisionEventChoice(activeDecisionEvent, choiceIndex)

      // Apply effects to session
      const currentQuality = decisionEventSession.quality || 0.5
      const newQuality = Math.max(0, Math.min(1, currentQuality + (result.qualityChange || 0) / 100))

      updateSession(decisionEventSession.id, {
        quality: newQuality,
        decisionsMade: [
          ...decisionEventSession.decisionsMade,
          {
            eventId: activeDecisionEvent.id,
            choiceIndex,
            effects: {
              quality: result.qualityChange,
              energy: result.energyChange,
              satisfaction: result.satisfactionChange,
            },
          },
        ],
      })

      // Apply energy cost to therapist
      if (result.energyChange) {
        const therapist = therapists.find((t) => t.id === decisionEventSession.therapistId)
        if (therapist) {
          updateTherapist(therapist.id, {
            // energyChange is a delta (often negative). Apply it directly.
            energy: Math.max(
              0,
              Math.min(therapist.maxEnergy, therapist.energy + result.energyChange)
            ),
          })
        }
      }

      setActiveDecisionEvent(null)
      setDecisionEventSession(null)
      resume('decision_event')
    },
    [activeDecisionEvent, decisionEventSession, therapists, updateSession, updateTherapist, resume]
  )

  // Handle new game start
  const handleStartGame = useCallback(
    (practiceName: string, playerTherapist: Therapist) => {
      newGame(practiceName, playerTherapist)
      setShowNewGame(false)
      setHasStartedGame(true)
      addNotification({
        type: 'success',
        title: 'Welcome!',
        message: `${practiceName} is now open for business!`,
      })
    },
    [newGame, addNotification]
  )

  // Auto-save every minute
  useEffect(() => {
    if (!hasStartedGame) return
    const cleanup = SaveManager.enableAutoSave(60000)
    return cleanup
  }, [hasStartedGame])

  // Check for existing save on mount
  useEffect(() => {
    const saveInfo = SaveManager.getSaveInfo()
    if (saveInfo) {
      // Load existing save - this already loads into the store
      const loaded = SaveManager.load()
      if (loaded) {
        // Use setTimeout to avoid setState in effect warning
        setTimeout(() => {
          setShowNewGame(false)
          setHasStartedGame(true)
        }, 0)
      }
    }
  }, [])

  // Speed controls
  const handleSpeedChange = useCallback(
    (speed: 0 | 1 | 2 | 3) => {
      if (speed === 0) {
        pause('manual')
      } else {
        resume('manual')
        setGameSpeed(speed)
      }
    },
    [pause, resume, setGameSpeed]
  )

  const handleSkipToNext = useCallback(() => {
    const nextTime = getNextSessionTime()
    if (nextTime) {
      const success = skipToNextSession()
      if (success) {
        addNotification({
          type: 'info',
          title: 'Skipped',
          message: `Jumped to Day ${nextTime.day}, ${formatTime(nextTime.hour, 0)}`,
        })
      }
    } else {
      addNotification({
        type: 'warning',
        title: 'No Sessions',
        message: 'No upcoming sessions to skip to',
      })
    }
  }, [getNextSessionTime, skipToNextSession, addNotification])

  // Handle starting a new game from settings
  const handleNewGame = useCallback(() => {
    setShowNewGame(true)
    setHasStartedGame(false)
    lastEventCheckDay.current = 0
  }, [])

  // Handle tutorial tab navigation
  const handleTutorialNavigateTab = useCallback((tabId: string) => {
    // Find and click the tab button with matching data-tab attribute
    const tabButton = document.querySelector(`[data-tab="${tabId}"]`) as HTMLButtonElement
    if (tabButton) {
      tabButton.click()
    }
  }, [])

  // Render new game modal if not started
  if (showNewGame) {
    return <NewGameModal isOpen={true} onStartGame={handleStartGame} />
  }

  return (
    <>
      <GameLayout onSpeedChange={handleSpeedChange} onSkip={handleSkipToNext} onNewGame={handleNewGame}>
        <GameView
          activeRandomEvent={activeRandomEvent}
          onRandomEventChoice={handleRandomEventChoice}
          activeDecisionEvent={activeDecisionEvent}
          decisionEventSession={decisionEventSession}
          onDecisionChoice={handleDecisionChoice}
        />
      </GameLayout>

      {activeDaySummary && (
        <DaySummaryModal
          summary={activeDaySummary}
          onContinue={handleDaySummaryContinue}
        />
      )}

      <TutorialOverlay onNavigateTab={handleTutorialNavigateTab} />
    </>
  )
}

export default App
