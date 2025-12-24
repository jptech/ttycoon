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
} from '@/core/types'
import { getPracticeLevelFromReputation } from '@/core/types'
import { EventBus, GameEvents } from '@/core/events'
import { ClientManager } from '@/core/clients'
import { ScheduleManager } from '@/core/schedule'
import { getSessionRate } from '@/data/clientGeneration'

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

  // Events
  addModifier: (modifier: GameModifier) => void
  removeModifier: (modifierId: string) => void
  setEventCooldown: (eventId: string, expiresDay: number) => void
  rememberDecision: (eventId: string, choiceIndex: number) => void

  // Training
  addActiveTraining: (training: ActiveTraining) => void
  updateActiveTraining: (therapistId: string, programId: string, updates: Partial<ActiveTraining>) => void
  removeActiveTraining: (therapistId: string, programId: string) => void

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

  // Events
  eventCooldowns: {},
  activeModifiers: [],
  rememberedDecisions: {},

  // Settings
  autoResolveSessions: false,
  soundEnabled: true,
  musicEnabled: true,
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
          }
        })
      },

      removeSession: (sessionId) => {
        set((state) => {
          state.sessions = state.sessions.filter((s) => s.id !== sessionId)
        })
      },

      updateSchedule: (schedule) => {
        set((state) => {
          state.schedule = schedule
        })
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
            Date.now() + i // Different seed for each client
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
        set({
          ...loadedState,
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
          // Events
          eventCooldowns,
          activeModifiers,
          rememberedDecisions,
          // Settings
          autoResolveSessions,
          soundEnabled,
          musicEnabled,
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
          therapists,
          clients,
          sessions,
          schedule,
          waitingList,
          activeTrainings,
          currentBuildingId,
          telehealthUnlocked,
          activePanels,
          eventCooldowns,
          activeModifiers,
          rememberedDecisions,
          autoResolveSessions,
          soundEnabled,
          musicEnabled,
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
