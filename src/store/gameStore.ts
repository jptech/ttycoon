import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  GameState,
  GameSpeed,
  Session,
  Therapist,
  Client,
  Schedule,
  InsurerId,
  PendingClaim,
  GameModifier,
  ActiveTraining,
  MilestoneId,
} from '@/core/types'
import { getPracticeLevelFromReputation, getMilestoneConfig, MILESTONES } from '@/core/types'
import { EventBus, GameEvents } from '@/core/events'
import { ClientManager } from '@/core/clients'
import { SessionManager } from '@/core/session/SessionManager'
import { ScheduleManager } from '@/core/schedule'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import { getSessionRate } from '@/data/clientGeneration'
import { BUILDINGS, getBuilding } from '@/data/buildings'
import { REPUTATION_CONFIG, getReputationChangeReason, getSessionReputationDelta } from '@/core/reputation'

/**
 * Actions available on the game store
 */
interface GameActions {
  // Time
  setGameSpeed: (speed: GameSpeed) => void
  advanceMinute: () => void
  pause: (reason: string) => void
  resume: (reason: string) => void

  // Economy
  addMoney: (amount: number, reason: string) => void
  removeMoney: (amount: number, reason: string) => boolean
  setBalance: (balance: number, reason: string) => void

  // Reputation
  addReputation: (amount: number, reason: string) => void
  removeReputation: (amount: number, reason: string) => void
  setReputation: (reputation: number, reason: string) => void

  // Sessions
  addSession: (session: Session) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  removeSession: (sessionId: string) => void
  updateSchedule: (schedule: Schedule) => void
  cancelSession: (sessionId: string, reason?: string) => { success: boolean; error?: string }
  rescheduleSession: (params: {
    sessionId: string
    therapistId: string
    day: number
    hour: number
    duration: 50 | 80 | 180
    isVirtual: boolean
  }) => { success: boolean; error?: string }
  completeSession: (
    sessionId: string
  ) =>
    | {
        session: Session
        therapist: Therapist
        client: Client
        xpGained: number
        leveledUp: boolean
        newLevel: number
        reputationDelta: number
        satisfactionChange: number
        treatmentProgressGained: number
        progressType: 'normal' | 'breakthrough' | 'plateau' | 'regression'
        progressDescription: string
        paymentAmount: number
      }
    | null

  // Entities
  addTherapist: (therapist: Therapist) => void
  updateTherapist: (therapistId: string, updates: Partial<Therapist>) => void
  removeTherapist: (therapistId: string) => void
  addClient: (client: Client) => void
  updateClient: (clientId: string, updates: Partial<Client>) => void
  removeClient: (clientId: string) => void
  removeFromWaitingList: (clientId: string) => void

  // Office
  setBuilding: (buildingId: string) => void
  unlockTelehealth: () => void

  // Insurance
  addInsurancePanel: (panelId: InsurerId) => void
  removeInsurancePanel: (panelId: InsurerId) => void
  addPendingClaim: (claim: PendingClaim) => void
  updatePendingClaim: (claimId: string, updates: Partial<PendingClaim>) => void
  removePendingClaim: (claimId: string) => void
  setInsuranceMultiplier: (multiplier: number) => void
  addHiringCapacityBonus: (bonus: number) => void

  // Events
  addModifier: (modifier: GameModifier) => void
  removeModifier: (modifierId: string) => void
  setEventCooldown: (eventId: string, expiresDay: number) => void
  rememberDecision: (eventId: string, choiceIndex: number) => void

  // Milestones
  awardMilestone: (milestoneId: MilestoneId) => boolean
  checkAndAwardMilestones: () => MilestoneId[]

  // Training
  addActiveTraining: (training: ActiveTraining) => void
  updateActiveTraining: (therapistId: string, programId: string, updates: Partial<ActiveTraining>) => void
  removeActiveTraining: (therapistId: string, programId: string) => void

  // QoL Settings
  setShowSessionSummaryModal: (show: boolean) => void
  setShowDaySummaryModal: (show: boolean) => void
  setAutoApplyDecisions: (autoApply: boolean) => void

  // Game management
  newGame: (practiceName: string, playerTherapist: Therapist) => void
  loadState: (state: GameState) => void
  getState: () => GameState
}

type GameStore = GameState & GameActions

/**
 * Initial state for a new game
 */
const createInitialState = (practiceName: string): GameState => ({
  // Meta
  practiceName,
  saveVersion: 1,

  // Time
  currentDay: 1,
  currentHour: 8,
  currentMinute: 0,
  gameSpeed: 1,
  isPaused: false,
  pauseReasons: [],

  // Economy
  balance: 5000,
  pendingClaims: [],
  insuranceMultiplier: 1.0,
  transactionHistory: [],
  reputationLog: [],

  // Reputation
  reputation: 20,
  practiceLevel: 1,

  // Entities
  therapists: [],
  clients: [],
  sessions: [],

  // Scheduling
  schedule: {},
  waitingList: [],

  // Training
  activeTrainings: [],

  // Office
  currentBuildingId: 'starter_suite',
  telehealthUnlocked: false,

  // Insurance
  activePanels: [],

  // Clinic bonuses (from business training)
  hiringCapacityBonus: 0,

  // Events
  eventCooldowns: {},
  activeModifiers: [],
  rememberedDecisions: {},

  // Milestones
  achievedMilestones: [],

  // Settings
  autoResolveSessions: false,
  soundEnabled: true,
  musicEnabled: true,
  showSessionSummaryModal: true,
  showDaySummaryModal: true,
  autoApplyDecisions: false,
})

/**
 * Main game store using Zustand with immer for immutable updates
 */
export const useGameStore = create<GameStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...createInitialState('My Practice'),

      // ==================== Time Actions ====================
      setGameSpeed: (speed) => {
        const oldSpeed = get().gameSpeed
        set((state) => {
          state.gameSpeed = speed
        })
        EventBus.emit(GameEvents.GAME_SPEED_CHANGED, { oldSpeed, newSpeed: speed })
      },

      advanceMinute: () => {
        set((state) => {
          state.currentMinute += 1

          if (state.currentMinute >= 60) {
            state.currentMinute = 0
            state.currentHour += 1

            EventBus.emit(GameEvents.HOUR_CHANGED, {
              hour: state.currentHour,
              isInitial: false,
            })

            // End of business day (5 PM)
            if (state.currentHour >= 17) {
              EventBus.emit(GameEvents.DAY_ENDED, { dayNumber: state.currentDay })
              state.currentDay += 1
              state.currentHour = 8
              state.currentMinute = 0
              EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: state.currentDay })
            }
          }

          EventBus.emit(GameEvents.MINUTE_CHANGED, { minute: state.currentMinute })
        })
      },

      pause: (reason) => {
        set((state) => {
          if (!state.pauseReasons.includes(reason)) {
            state.pauseReasons.push(reason)
          }
          state.isPaused = true
        })
        EventBus.emit(GameEvents.GAME_PAUSED, { reason })
      },

      resume: (reason) => {
        set((state) => {
          state.pauseReasons = state.pauseReasons.filter((r) => r !== reason)
          state.isPaused = state.pauseReasons.length > 0
        })
        EventBus.emit(GameEvents.GAME_RESUMED, { reason })
      },

      // ==================== Economy Actions ====================
      addMoney: (amount, reason) => {
        set((state) => {
          const oldBalance = state.balance
          state.balance += amount
          state.transactionHistory.push({
            id: crypto.randomUUID(),
            day: state.currentDay,
            type: 'income',
            category: reason,
            amount,
            description: reason,
          })
          EventBus.emit(GameEvents.MONEY_CHANGED, {
            oldBalance,
            newBalance: state.balance,
            reason,
          })
        })
      },

      removeMoney: (amount, reason) => {
        const state = get()
        if (state.balance < amount) {
          return false
        }

        set((state) => {
          const oldBalance = state.balance
          state.balance -= amount
          state.transactionHistory.push({
            id: crypto.randomUUID(),
            day: state.currentDay,
            type: 'expense',
            category: reason,
            amount,
            description: reason,
          })
          EventBus.emit(GameEvents.MONEY_CHANGED, {
            oldBalance,
            newBalance: state.balance,
            reason,
          })
        })

        return true
      },

      setBalance: (balance, reason) => {
        set((state) => {
          const oldBalance = state.balance
          const nextBalance = Math.max(0, Math.floor(balance))
          const delta = nextBalance - oldBalance

          state.balance = nextBalance

          if (delta !== 0) {
            state.transactionHistory.push({
              id: crypto.randomUUID(),
              day: state.currentDay,
              type: delta > 0 ? 'income' : 'expense',
              category: reason,
              amount: Math.abs(delta),
              description: reason,
            })
          }

          EventBus.emit(GameEvents.MONEY_CHANGED, {
            oldBalance,
            newBalance: state.balance,
            reason,
          })
        })
      },

      // ==================== Reputation Actions ====================
      addReputation: (amount, reason) => {
        set((state) => {
          const oldValue = state.reputation
          state.reputation = Math.min(500, state.reputation + amount)

          const change = state.reputation - oldValue
          if (change !== 0) {
            state.reputationLog.unshift({
              id: crypto.randomUUID(),
              day: state.currentDay,
              hour: state.currentHour,
              minute: state.currentMinute,
              reason,
              change,
              before: oldValue,
              after: state.reputation,
            })
            if (state.reputationLog.length > 50) {
              state.reputationLog = state.reputationLog.slice(0, 50)
            }
          }

          const newLevel = getPracticeLevelFromReputation(state.reputation)
          if (newLevel !== state.practiceLevel) {
            const oldLevel = state.practiceLevel
            state.practiceLevel = newLevel
            EventBus.emit(GameEvents.PRACTICE_LEVEL_CHANGED, { oldLevel, newLevel })
          }

          EventBus.emit(GameEvents.REPUTATION_CHANGED, {
            oldValue,
            newValue: state.reputation,
            reason,
          })
        })
      },

      removeReputation: (amount, reason) => {
        set((state) => {
          const oldValue = state.reputation
          state.reputation = Math.max(0, state.reputation - amount)

          const change = state.reputation - oldValue
          if (change !== 0) {
            state.reputationLog.unshift({
              id: crypto.randomUUID(),
              day: state.currentDay,
              hour: state.currentHour,
              minute: state.currentMinute,
              reason,
              change,
              before: oldValue,
              after: state.reputation,
            })
            if (state.reputationLog.length > 50) {
              state.reputationLog = state.reputationLog.slice(0, 50)
            }
          }

          const newLevel = getPracticeLevelFromReputation(state.reputation)
          if (newLevel !== state.practiceLevel) {
            const oldLevel = state.practiceLevel
            state.practiceLevel = newLevel
            EventBus.emit(GameEvents.PRACTICE_LEVEL_CHANGED, { oldLevel, newLevel })
          }

          EventBus.emit(GameEvents.REPUTATION_CHANGED, {
            oldValue,
            newValue: state.reputation,
            reason,
          })
        })
      },

      setReputation: (reputation, reason) => {
        set((state) => {
          const oldValue = state.reputation
          state.reputation = Math.max(0, Math.min(500, Math.floor(reputation)))

          const change = state.reputation - oldValue
          if (change !== 0) {
            state.reputationLog.unshift({
              id: crypto.randomUUID(),
              day: state.currentDay,
              hour: state.currentHour,
              minute: state.currentMinute,
              reason,
              change,
              before: oldValue,
              after: state.reputation,
            })
            if (state.reputationLog.length > 50) {
              state.reputationLog = state.reputationLog.slice(0, 50)
            }
          }

          const newLevel = getPracticeLevelFromReputation(state.reputation)
          if (newLevel !== state.practiceLevel) {
            const oldLevel = state.practiceLevel
            state.practiceLevel = newLevel
            EventBus.emit(GameEvents.PRACTICE_LEVEL_CHANGED, { oldLevel, newLevel })
          }

          EventBus.emit(GameEvents.REPUTATION_CHANGED, {
            oldValue,
            newValue: state.reputation,
            reason,
          })
        })
      },

      // ==================== Sessions ====================
      addSession: (session) => {
        set((state) => {
          state.sessions.push(session)
          // CRIT-001 fix: Rebuild schedule after adding session
          state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)
        })
        EventBus.emit(GameEvents.SESSION_SCHEDULED, {
          sessionId: session.id,
          clientId: session.clientId,
          therapistId: session.therapistId,
          day: session.scheduledDay,
          hour: session.scheduledHour,
        })
      },

      updateSession: (sessionId, updates) => {
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === sessionId)
          if (index !== -1) {
            state.sessions[index] = { ...state.sessions[index], ...updates }
            // CRIT-001 fix: Rebuild schedule if scheduling-related fields changed
            if (
              'scheduledDay' in updates ||
              'scheduledHour' in updates ||
              'durationMinutes' in updates ||
              'therapistId' in updates ||
              'status' in updates
            ) {
              state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)
            }
          }
        })
      },

      removeSession: (sessionId) => {
        set((state) => {
          state.sessions = state.sessions.filter((s) => s.id !== sessionId)
          // CRIT-001 fix: Rebuild schedule after removing session
          state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)
        })
        // CRIT-004 fix: Emit event when session is removed
        EventBus.emit(GameEvents.SESSION_CANCELLED, { sessionId, reason: 'Session removed' })
      },

      updateSchedule: (schedule) => {
        set((state) => {
          state.schedule = schedule
        })
      },

      completeSession: (sessionId) => {
        const snapshot = get()
        const session = snapshot.sessions.find((s) => s.id === sessionId)
        if (!session) return null

        // Prevent double-completion (avoids double payouts / double XP / double rep).
        if (session.status === 'completed') return null

        const therapist = snapshot.therapists.find((t) => t.id === session.therapistId)
        const client = snapshot.clients.find((c) => c.id === session.clientId)
        if (!therapist || !client) return null

        const result = SessionManager.completeSession(session, therapist, client, {
          day: snapshot.currentDay,
          hour: snapshot.currentHour,
          minute: snapshot.currentMinute,
        })

        // Apply entity updates.
        set((state) => {
          const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId)
          if (sessionIndex !== -1) {
            state.sessions[sessionIndex] = result.session
          }

          const therapistIndex = state.therapists.findIndex((t) => t.id === therapist.id)
          if (therapistIndex !== -1) {
            const previousStatus = state.therapists[therapistIndex].status
            state.therapists[therapistIndex] = {
              ...result.therapist,
              // Only reset to 'available' if they were actively in-session.
              // Preserve statuses like 'on_break' / 'in_training'.
              status: previousStatus === 'in_session' ? 'available' : previousStatus,
            }
          }

          const clientIndex = state.clients.findIndex((c) => c.id === client.id)
          if (clientIndex !== -1) {
            state.clients[clientIndex] = result.client
          }

          // Safety: ensure completed/in-treatment clients aren't lingering in waiting list.
          if (result.client.status !== 'waiting') {
            state.waitingList = state.waitingList.filter((id) => id !== result.client.id)
          }
        })

        // Economy + reputation rewards.
        const reputationDelta = getSessionReputationDelta(result.session.quality)
        const reason = getReputationChangeReason(result.session.quality)

        if (result.paymentAmount !== 0) {
          get().addMoney(result.paymentAmount, `Session with ${result.session.clientName}`)
        }

        if (reputationDelta > 0) {
          get().addReputation(reputationDelta, reason)
        } else if (reputationDelta < 0) {
          get().removeReputation(-reputationDelta, reason)
        }

        if (client.status !== 'completed' && result.client.status === 'completed') {
          get().addReputation(
            REPUTATION_CONFIG.CLIENT_CURED_BONUS,
            `Completed treatment for ${result.client.displayName}`
          )
          EventBus.emit(GameEvents.CLIENT_CURED, {
            clientId: result.client.id,
            sessionsCompleted: result.client.sessionsCompleted,
          })
        }

        // Emit therapist level-up event if applicable
        if (result.leveledUp) {
          EventBus.emit(GameEvents.THERAPIST_LEVELED_UP, {
            therapistId: result.therapist.id,
            newLevel: result.newLevel,
          })
        }

        return {
          session: result.session,
          therapist: result.therapist,
          client: result.client,
          xpGained: result.xpGained,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
          reputationDelta,
          satisfactionChange: result.satisfactionChange,
          treatmentProgressGained: result.treatmentProgressGained,
          progressType: result.progressType,
          progressDescription: result.progressDescription,
          paymentAmount: result.paymentAmount,
        }
      },

      cancelSession: (sessionId, reason = 'Cancelled by player') => {
        const snapshot = get()
        const session = snapshot.sessions.find((s) => s.id === sessionId)
        if (!session) return { success: false, error: 'Session not found' }

        if (session.status !== 'scheduled') {
          return { success: false, error: `Cannot cancel a ${session.status} session` }
        }

        const currentTime = {
          day: snapshot.currentDay,
          hour: snapshot.currentHour,
          minute: snapshot.currentMinute,
        }

        const timeCheck = ScheduleManager.validateNotInPast(currentTime, session.scheduledDay, session.scheduledHour)
        if (!timeCheck.valid) {
          return { success: false, error: 'Cannot cancel a session in the past' }
        }

        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === sessionId)
          if (index === -1) return
          state.sessions[index] = { ...state.sessions[index], status: 'cancelled' }

          // Cancelled sessions should not occupy schedule slots.
          state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)
        })

        EventBus.emit(GameEvents.SESSION_CANCELLED, { sessionId, reason })
        return { success: true }
      },

      rescheduleSession: ({ sessionId, therapistId, day, hour, duration, isVirtual }) => {
        const snapshot = get()
        const session = snapshot.sessions.find((s) => s.id === sessionId)
        if (!session) return { success: false, error: 'Session not found' }

        if (session.status !== 'scheduled') {
          return { success: false, error: `Cannot reschedule a ${session.status} session` }
        }

        const currentTime = {
          day: snapshot.currentDay,
          hour: snapshot.currentHour,
          minute: snapshot.currentMinute,
        }

        // Cannot reschedule a session that is already in the past.
        const existingTimeCheck = ScheduleManager.validateNotInPast(currentTime, session.scheduledDay, session.scheduledHour)
        if (!existingTimeCheck.valid) {
          return { success: false, error: 'Cannot reschedule a session in the past' }
        }

        // Cannot schedule something previous to the current time.
        const targetTimeCheck = ScheduleManager.validateNotInPast(currentTime, day, hour)
        if (!targetTimeCheck.valid) {
          return { success: false, error: targetTimeCheck.reason || 'Cannot schedule a session in the past.' }
        }

        // Exclude the session being moved from constraint checks.
        const sessionsWithoutThis = snapshot.sessions.filter((s) => s.id !== sessionId)
        const scheduleWithoutThis = ScheduleManager.buildScheduleFromSessions(sessionsWithoutThis)

        // Must satisfy the same constraints as standard booking.
        const therapistSlotAvailable = ScheduleManager.isSlotAvailable(
          scheduleWithoutThis,
          therapistId,
          day,
          hour,
          duration
        )

        if (!therapistSlotAvailable) {
          return { success: false, error: 'This time slot is already booked. Please select another.' }
        }

        const clientConflict = ScheduleManager.clientHasConflictingSession(
          sessionsWithoutThis,
          session.clientId,
          day,
          hour,
          duration
        )

        if (clientConflict) {
          return { success: false, error: 'Client already has a session scheduled at this time.' }
        }

        const building = getBuilding(snapshot.currentBuildingId) || BUILDINGS.starter_suite
        const typeCheck = canBookSessionType({
          building,
          sessions: sessionsWithoutThis,
          telehealthUnlocked: snapshot.telehealthUnlocked,
          isVirtual,
          day,
          hour,
          durationMinutes: duration,
        })

        if (!typeCheck.canBook) {
          return { success: false, error: typeCheck.reason }
        }

        // Apply reschedule.
        set((state) => {
          const therapist = state.therapists.find((t) => t.id === therapistId)
          const client = state.clients.find((c) => c.id === session.clientId)
          const index = state.sessions.findIndex((s) => s.id === sessionId)
          if (index === -1) return

          state.sessions[index] = {
            ...state.sessions[index],
            therapistId,
            scheduledDay: day,
            scheduledHour: hour,
            durationMinutes: duration,
            isVirtual,
            therapistName: therapist?.displayName ?? state.sessions[index].therapistName,
            clientName: client?.displayName ?? state.sessions[index].clientName,
          }

          state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)
        })

        EventBus.emit(GameEvents.SESSION_SCHEDULED, {
          sessionId,
          clientId: session.clientId,
          therapistId,
          day,
          hour,
        })

        return { success: true }
      },

      // ==================== Entities ====================
      addTherapist: (therapist) => {
        set((state) => {
          state.therapists.push(therapist)
        })
        EventBus.emit(GameEvents.THERAPIST_HIRED, {
          therapistId: therapist.id,
          isPlayer: therapist.isPlayer,
        })
      },

      updateTherapist: (therapistId, updates) => {
        set((state) => {
          const index = state.therapists.findIndex((t) => t.id === therapistId)
          if (index !== -1) {
            state.therapists[index] = { ...state.therapists[index], ...updates }
          }
        })
      },

      removeTherapist: (therapistId) => {
        set((state) => {
          state.therapists = state.therapists.filter((t) => t.id !== therapistId)
        })
      },

      addClient: (client) => {
        set((state) => {
          state.clients.push(client)
          state.waitingList.push(client.id)
        })
        EventBus.emit(GameEvents.CLIENT_ARRIVED, {
          clientId: client.id,
          conditionCategory: client.conditionCategory,
        })
      },

      updateClient: (clientId, updates) => {
        set((state) => {
          const index = state.clients.findIndex((c) => c.id === clientId)
          if (index !== -1) {
            state.clients[index] = { ...state.clients[index], ...updates }
          }
        })
      },

      removeClient: (clientId) => {
        set((state) => {
          state.clients = state.clients.filter((c) => c.id !== clientId)
          state.waitingList = state.waitingList.filter((id) => id !== clientId)
        })
      },

      removeFromWaitingList: (clientId) => {
        set((state) => {
          state.waitingList = state.waitingList.filter((id) => id !== clientId)
        })
      },

      // ==================== Office ====================
      setBuilding: (buildingId) => {
        set((state) => {
          state.currentBuildingId = buildingId
        })
        EventBus.emit(GameEvents.BUILDING_UPGRADED, { buildingId })
      },

      unlockTelehealth: () => {
        set((state) => {
          state.telehealthUnlocked = true
        })
      },

      // ==================== Insurance ====================
      addInsurancePanel: (panelId) => {
        set((state) => {
          if (!state.activePanels.includes(panelId)) {
            state.activePanels.push(panelId)
          }
        })
      },

      removeInsurancePanel: (panelId) => {
        set((state) => {
          state.activePanels = state.activePanels.filter((id) => id !== panelId)
        })
      },

      addPendingClaim: (claim) => {
        set((state) => {
          state.pendingClaims.push(claim)
        })
      },

      updatePendingClaim: (claimId, updates) => {
        set((state) => {
          const index = state.pendingClaims.findIndex((c) => c.id === claimId)
          if (index !== -1) {
            state.pendingClaims[index] = { ...state.pendingClaims[index], ...updates }
          }
        })
      },

      removePendingClaim: (claimId) => {
        set((state) => {
          state.pendingClaims = state.pendingClaims.filter((c) => c.id !== claimId)
        })
      },

      setInsuranceMultiplier: (multiplier) => {
        set((state) => {
          state.insuranceMultiplier = multiplier
        })
      },

      addHiringCapacityBonus: (bonus) => {
        set((state) => {
          state.hiringCapacityBonus += bonus
        })
      },

      // ==================== Events ====================
      addModifier: (modifier) => {
        set((state) => {
          state.activeModifiers.push(modifier)
        })
      },

      removeModifier: (modifierId) => {
        set((state) => {
          state.activeModifiers = state.activeModifiers.filter((m) => m.id !== modifierId)
        })
      },

      setEventCooldown: (eventId, expiresDay) => {
        set((state) => {
          state.eventCooldowns[eventId] = expiresDay
        })
      },

      rememberDecision: (eventId, choiceIndex) => {
        set((state) => {
          state.rememberedDecisions[eventId] = choiceIndex
        })
      },

      // ==================== Milestones ====================
      awardMilestone: (milestoneId) => {
        const snapshot = get()
        if (snapshot.achievedMilestones.includes(milestoneId)) {
          return false // Already achieved
        }

        const config = getMilestoneConfig(milestoneId)
        if (!config) return false

        set((state) => {
          state.achievedMilestones.push(milestoneId)
        })

        // Award reputation bonus
        get().addReputation(config.reputationBonus, `Milestone: ${config.name}`)

        EventBus.emit(GameEvents.MILESTONE_ACHIEVED, {
          milestoneId,
          name: config.name,
          reputationBonus: config.reputationBonus,
        })

        return true
      },

      checkAndAwardMilestones: () => {
        const snapshot = get()
        const awarded: MilestoneId[] = []
        const completed = snapshot.sessions.filter((s) => s.status === 'completed').length
        const curedClients = snapshot.clients.filter((c) => c.status === 'completed').length
        const employees = snapshot.therapists.filter((t) => !t.isPlayer).length

        // Check each milestone
        for (const milestone of MILESTONES) {
          if (snapshot.achievedMilestones.includes(milestone.id)) continue

          let shouldAward = false

          switch (milestone.id) {
            case 'first_session_completed':
              shouldAward = completed >= 1
              break
            case 'first_week_completed':
              shouldAward = snapshot.currentDay >= 8
              break
            case 'first_client_cured':
              shouldAward = curedClients >= 1
              break
            case 'first_employee_hired':
              shouldAward = employees >= 1
              break
            case 'sessions_10_completed':
              shouldAward = completed >= 10
              break
            case 'sessions_25_completed':
              shouldAward = completed >= 25
              break
            case 'sessions_50_completed':
              shouldAward = completed >= 50
              break
            case 'sessions_100_completed':
              shouldAward = completed >= 100
              break
            case 'clients_5_cured':
              shouldAward = curedClients >= 5
              break
            case 'clients_10_cured':
              shouldAward = curedClients >= 10
              break
            case 'practice_level_2':
              shouldAward = snapshot.practiceLevel >= 2
              break
            case 'practice_level_3':
              shouldAward = snapshot.practiceLevel >= 3
              break
            case 'practice_level_4':
              shouldAward = snapshot.practiceLevel >= 4
              break
            case 'practice_level_5':
              shouldAward = snapshot.practiceLevel >= 5
              break
          }

          if (shouldAward) {
            const didAward = get().awardMilestone(milestone.id)
            if (didAward) awarded.push(milestone.id)
          }
        }

        return awarded
      },

      // ==================== Training ====================
      addActiveTraining: (training) => {
        set((state) => {
          state.activeTrainings.push(training)
        })
        EventBus.emit(GameEvents.TRAINING_STARTED, {
          programId: training.programId,
          therapistId: training.therapistId,
        })
      },

      updateActiveTraining: (therapistId, programId, updates) => {
        set((state) => {
          const index = state.activeTrainings.findIndex(
            (t) => t.programId === programId && t.therapistId === therapistId
          )
          if (index !== -1) {
            state.activeTrainings[index] = { ...state.activeTrainings[index], ...updates }
          }
        })
      },

      removeActiveTraining: (therapistId, programId) => {
        set((state) => {
          state.activeTrainings = state.activeTrainings.filter(
            (t) => !(t.programId === programId && t.therapistId === therapistId)
          )
        })
      },

      // ==================== QoL Settings ====================
      setShowSessionSummaryModal: (show) => {
        set((state) => {
          state.showSessionSummaryModal = show
        })
      },

      setShowDaySummaryModal: (show) => {
        set((state) => {
          state.showDaySummaryModal = show
        })
      },

      setAutoApplyDecisions: (autoApply) => {
        set((state) => {
          state.autoApplyDecisions = autoApply
        })
      },

      // ==================== Game Management ====================
      newGame: (practiceName, playerTherapist) => {
        const initialState = createInitialState(practiceName)
        initialState.therapists = [playerTherapist]

        // Generate 2-3 initial clients to smooth out early game
        const initialClientCount = 2 + Math.floor(Math.random() * 2) // 2-3 clients
        const initialClients: Client[] = []
        const initialWaitingList: string[] = []

        for (let i = 0; i < initialClientCount; i++) {
          const sessionRate = getSessionRate(Math.random() < 0.3) // 30% private pay
          const result = ClientManager.generateClient(
            1, // Day 1
            [], // No insurance panels yet
            sessionRate,
            Date.now() + i, // Different seed for each client
            { forceNoCredentials: true }
          )
          initialClients.push(result.client)
          initialWaitingList.push(result.client.id)
        }

        initialState.clients = initialClients
        initialState.waitingList = initialWaitingList

        set(initialState)
        EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 1 })
      },

      loadState: (loadedState) => {
        // Defensive: ensure schedule contains all scheduled sessions.
        // (Keeps UI + engine behavior consistent even if saves are missing schedule entries.)

        // Migration: Add credential and modality to existing therapists that don't have them
        const migratedTherapists = loadedState.therapists.map((therapist) => {
          if (!therapist.credential || !therapist.primaryModality) {
            return {
              ...therapist,
              credential: therapist.credential ?? (therapist.isPlayer ? 'LPC' : 'LMFT'),
              primaryModality: therapist.primaryModality ?? 'Integrative',
              secondaryModalities: therapist.secondaryModalities ?? [],
            }
          }
          return therapist
        })

        set({
          ...loadedState,
          therapists: migratedTherapists,
          reputationLog: loadedState.reputationLog ?? [],
          schedule: ScheduleManager.buildScheduleFromSessions(loadedState.sessions),
        })
        EventBus.emit(GameEvents.GAME_LOADED, { timestamp: Date.now() })
      },

      getState: () => {
        const fullState = get()
        // Extract only the state properties, excluding action methods
        const {
          // Meta
          practiceName,
          saveVersion,
          // Time
          currentDay,
          currentHour,
          currentMinute,
          gameSpeed,
          isPaused,
          pauseReasons,
          // Economy
          balance,
          pendingClaims,
          insuranceMultiplier,
          transactionHistory,
          // Reputation
          reputation,
          practiceLevel,
          reputationLog,
          // Entities
          therapists,
          clients,
          sessions,
          // Scheduling
          schedule,
          waitingList,
          // Training
          activeTrainings,
          // Office
          currentBuildingId,
          telehealthUnlocked,
          // Insurance
          activePanels,
          // Clinic bonuses
          hiringCapacityBonus,
          // Events
          eventCooldowns,
          activeModifiers,
          rememberedDecisions,
          // Milestones
          achievedMilestones,
          // Settings
          autoResolveSessions,
          soundEnabled,
          musicEnabled,
          showSessionSummaryModal,
          showDaySummaryModal,
          autoApplyDecisions,
        } = fullState
        return {
          practiceName,
          saveVersion,
          currentDay,
          currentHour,
          currentMinute,
          gameSpeed,
          isPaused,
          pauseReasons,
          balance,
          pendingClaims,
          insuranceMultiplier,
          transactionHistory,
          reputation,
          practiceLevel,
          reputationLog,
          therapists,
          clients,
          sessions,
          schedule,
          waitingList,
          activeTrainings,
          currentBuildingId,
          telehealthUnlocked,
          activePanels,
          hiringCapacityBonus,
          eventCooldowns,
          activeModifiers,
          rememberedDecisions,
          achievedMilestones,
          autoResolveSessions,
          soundEnabled,
          musicEnabled,
          showSessionSummaryModal,
          showDaySummaryModal,
          autoApplyDecisions,
        }
      },
    }))
  )
)

// ==================== Selectors ====================

export const selectGameTime = (state: GameStore) => ({
  day: state.currentDay,
  hour: state.currentHour,
  minute: state.currentMinute,
})

export const selectBalance = (state: GameStore) => state.balance

export const selectReputation = (state: GameStore) => ({
  reputation: state.reputation,
  practiceLevel: state.practiceLevel,
})

export const selectGameSpeed = (state: GameStore) => state.gameSpeed

export const selectIsPaused = (state: GameStore) => state.isPaused
