import { create } from 'zustand'
import { EventBus, GameEvents } from '@/core/events'
import { TUTORIAL_STEPS } from '@/core/tutorial'

/**
 * Modal types available in the game
 */
export type ModalType =
  | 'hiring'
  | 'training'
  | 'budget'
  | 'progression'
  | 'reputation'
  | 'clientManagement'
  | 'clientDetails'
  | 'scheduling'
  | 'office'
  | 'insurance'
  | 'settings'
  | 'cheats'
  | 'help'
  | 'decisionEvent'
  | 'randomEvent'
  | 'daySummary'
  | 'newGame'

interface ModalState {
  type: ModalType
  props?: Record<string, unknown>
}

/**
 * UI store for non-game-state UI concerns
 */
interface UIStore {
  // Modal state
  activeModal: ModalState | null
  modalStack: ModalState[]

  // Modal actions
  openModal: (type: ModalType, props?: Record<string, unknown>) => void
  closeModal: () => void
  closeAllModals: () => void

  // Side panel state
  activeSidePanel: 'schedule' | 'session' | 'clients'
  setSidePanel: (panel: 'schedule' | 'session' | 'clients') => void

  // Selection state
  selectedClientId: string | null
  selectedTherapistId: string | null
  selectClient: (id: string | null) => void
  selectTherapist: (id: string | null) => void

  // Scheduling mode
  schedulingMode: {
    active: boolean
    clientId: string | null
    therapistId: string | null
  }
  enterSchedulingMode: (clientId: string, therapistId?: string) => void
  exitSchedulingMode: () => void

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Tutorial state
  tutorialState: {
    isActive: boolean
    currentStepIndex: number
    hasSeenTutorial: boolean
  }
  startTutorial: () => void
  nextTutorialStep: () => void
  prevTutorialStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  setHasSeenTutorial: (seen: boolean) => void
}

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'achievement'
  title: string
  message?: string
  duration?: number // ms, 0 for persistent
}

export const useUIStore = create<UIStore>((set, get) => ({
  // Initial state
  activeModal: null,
  modalStack: [],
  activeSidePanel: 'schedule',
  selectedClientId: null,
  selectedTherapistId: null,
  schedulingMode: {
    active: false,
    clientId: null,
    therapistId: null,
  },
  notifications: [],
  tutorialState: {
    isActive: false,
    currentStepIndex: 0,
    hasSeenTutorial: false,
  },

  // Modal actions
  openModal: (type, props) => {
    const current = get().activeModal

    set((state) => ({
      activeModal: { type, props },
      modalStack: current ? [...state.modalStack, current] : state.modalStack,
    }))

    // Pause game when modal opens
    EventBus.emit(GameEvents.GAME_PAUSED, { reason: `modal_${type}` })
  },

  closeModal: () => {
    const { modalStack, activeModal } = get()

    if (modalStack.length > 0) {
      // HIGH-001 fix: Don't emit GAME_RESUMED when restoring from stack
      // Another modal is becoming active, so game should stay paused
      const previous = modalStack[modalStack.length - 1]
      set({
        activeModal: previous,
        modalStack: modalStack.slice(0, -1),
      })
    } else {
      // Only emit GAME_RESUMED when closing the last modal
      if (activeModal) {
        EventBus.emit(GameEvents.GAME_RESUMED, { reason: `modal_${activeModal.type}` })
      }
      set({ activeModal: null })
    }
  },

  closeAllModals: () => {
    const { activeModal, modalStack } = get()

    // Resume all pauses
    if (activeModal) {
      EventBus.emit(GameEvents.GAME_RESUMED, { reason: `modal_${activeModal.type}` })
    }
    for (const modal of modalStack) {
      EventBus.emit(GameEvents.GAME_RESUMED, { reason: `modal_${modal.type}` })
    }

    set({ activeModal: null, modalStack: [] })
  },

  // Side panel
  setSidePanel: (panel) => {
    set({ activeSidePanel: panel })
  },

  // Selection
  selectClient: (id) => {
    set({ selectedClientId: id })
  },

  selectTherapist: (id) => {
    set({ selectedTherapistId: id })
  },

  // Scheduling mode
  enterSchedulingMode: (clientId, therapistId) => {
    set({
      schedulingMode: {
        active: true,
        clientId,
        therapistId: therapistId ?? null,
      },
      activeSidePanel: 'schedule',
    })
  },

  exitSchedulingMode: () => {
    set({
      schedulingMode: {
        active: false,
        clientId: null,
        therapistId: null,
      },
    })
  },

  // Notifications
  addNotification: (notification) => {
    const id = crypto.randomUUID()
    const duration = notification.duration ?? 5000

    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }))

    // Auto-remove after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }))
      }, duration)
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },

  // Tutorial actions
  startTutorial: () => {
    set({
      tutorialState: {
        isActive: true,
        currentStepIndex: 0,
        hasSeenTutorial: false,
      },
    })
    EventBus.emit(GameEvents.GAME_PAUSED, { reason: 'tutorial' })
  },

  nextTutorialStep: () => {
    const { tutorialState } = get()
    const nextIndex = tutorialState.currentStepIndex + 1

    if (nextIndex >= TUTORIAL_STEPS.length) {
      // Complete tutorial
      get().completeTutorial()
    } else {
      set({
        tutorialState: {
          ...tutorialState,
          currentStepIndex: nextIndex,
        },
      })
    }
  },

  prevTutorialStep: () => {
    const { tutorialState } = get()
    const prevIndex = Math.max(0, tutorialState.currentStepIndex - 1)

    set({
      tutorialState: {
        ...tutorialState,
        currentStepIndex: prevIndex,
      },
    })
  },

  skipTutorial: () => {
    set({
      tutorialState: {
        isActive: false,
        currentStepIndex: 0,
        hasSeenTutorial: true,
      },
    })
    EventBus.emit(GameEvents.GAME_RESUMED, { reason: 'tutorial' })
  },

  completeTutorial: () => {
    set({
      tutorialState: {
        isActive: false,
        currentStepIndex: 0,
        hasSeenTutorial: true,
      },
    })
    EventBus.emit(GameEvents.GAME_RESUMED, { reason: 'tutorial' })
  },

  setHasSeenTutorial: (seen) => {
    set((state) => ({
      tutorialState: {
        ...state.tutorialState,
        hasSeenTutorial: seen,
      },
    }))
  },
}))

// Selectors
export const selectActiveModal = (state: UIStore) => state.activeModal
export const selectNotifications = (state: UIStore) => state.notifications
export const selectSchedulingMode = (state: UIStore) => state.schedulingMode
export const selectTutorialState = (state: UIStore) => state.tutorialState
