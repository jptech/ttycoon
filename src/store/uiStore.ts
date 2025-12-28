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

  // Notification batching
  pendingBatches: Map<string, PendingBatch>
  queueNotification: (key: string, notification: Omit<Notification, 'id'>, singularMessage?: string) => void
  flushBatch: (key: string) => void

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

  // Notification inbox
  inboxNotifications: InboxNotification[]
  unreadCount: number
  isInboxOpen: boolean
  addToInbox: (notification: Omit<Notification, 'id'>, priority?: NotificationPriority) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearInbox: () => void
  toggleInbox: () => void
  setInboxOpen: (open: boolean) => void
}

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'achievement'
  title: string
  message?: string
  duration?: number // ms, 0 for persistent
}

/**
 * Priority levels for inbox notifications
 * - critical: Shows as toast AND goes to inbox (errors, important warnings)
 * - normal: Goes to inbox only, increments unread count
 * - low: Goes to inbox only, does NOT increment unread count
 */
export type NotificationPriority = 'critical' | 'normal' | 'low'

export interface InboxNotification extends Notification {
  timestamp: number
  isRead: boolean
  priority: NotificationPriority
}

/** Max notifications to keep in inbox (FIFO) */
const MAX_INBOX_NOTIFICATIONS = 100

/** Keywords that indicate a critical warning */
const CRITICAL_WARNING_KEYWORDS = ['burnout', 'dropped', 'denied', 'failed', 'left', 'at risk']

interface PendingBatch {
  notification: Omit<Notification, 'id'>
  count: number
  timer: ReturnType<typeof setTimeout> | null
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
  pendingBatches: new Map(),
  tutorialState: {
    isActive: false,
    currentStepIndex: 0,
    hasSeenTutorial: false,
  },
  inboxNotifications: [],
  unreadCount: 0,
  isInboxOpen: false,

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

    // Classify priority for routing
    const priority = classifyNotificationPriority(notification)

    // Always add to inbox
    get().addToInbox(notification, priority)

    // Only show as toast if critical
    if (priority === 'critical') {
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

  // Notification batching
  queueNotification: (key, notification, singularMessage) => {
    const { pendingBatches, flushBatch } = get()
    const existing = pendingBatches.get(key)

    if (existing) {
      // Clear existing timer and increment count
      if (existing.timer) {
        clearTimeout(existing.timer)
      }
      existing.count++
      const newTimer = setTimeout(() => flushBatch(key), 300)
      pendingBatches.set(key, { ...existing, timer: newTimer })
    } else {
      // Start new batch with 300ms window
      const timer = setTimeout(() => flushBatch(key), 300)
      pendingBatches.set(key, {
        notification: { ...notification, message: singularMessage || notification.message },
        count: 1,
        timer,
      })
    }
  },

  flushBatch: (key) => {
    const { pendingBatches, addNotification } = get()
    const batch = pendingBatches.get(key)

    if (!batch) return

    if (batch.timer) {
      clearTimeout(batch.timer)
    }

    if (batch.count === 1) {
      // Single notification - show as-is
      addNotification(batch.notification)
    } else {
      // Grouped notification - show count
      addNotification({
        ...batch.notification,
        message: `${batch.count} ${batch.notification.message || 'items'}`,
      })
    }

    pendingBatches.delete(key)
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

  // Notification inbox actions
  addToInbox: (notification, priority) => {
    const id = crypto.randomUUID()
    const timestamp = Date.now()

    // Auto-classify priority if not provided
    const classifiedPriority = priority ?? classifyNotificationPriority(notification)

    const inboxNotification: InboxNotification = {
      ...notification,
      id,
      timestamp,
      isRead: false,
      priority: classifiedPriority,
    }

    set((state) => {
      // FIFO: remove oldest if at max
      const notifications = [...state.inboxNotifications, inboxNotification]
      if (notifications.length > MAX_INBOX_NOTIFICATIONS) {
        notifications.shift()
      }

      // Only increment unread for non-low priority
      const unreadIncrement = classifiedPriority !== 'low' ? 1 : 0

      return {
        inboxNotifications: notifications,
        unreadCount: state.unreadCount + unreadIncrement,
      }
    })
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.inboxNotifications.find((n) => n.id === id)
      if (!notification || notification.isRead) return state

      return {
        inboxNotifications: state.inboxNotifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - (notification.priority !== 'low' ? 1 : 0)),
      }
    })
  },

  markAllAsRead: () => {
    set((state) => ({
      inboxNotifications: state.inboxNotifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }))
  },

  clearInbox: () => {
    set({ inboxNotifications: [], unreadCount: 0 })
  },

  toggleInbox: () => {
    set((state) => ({ isInboxOpen: !state.isInboxOpen }))
  },

  setInboxOpen: (open) => {
    set({ isInboxOpen: open })
  },
}))

/**
 * Classify notification priority based on type and content
 */
function classifyNotificationPriority(notification: Omit<Notification, 'id'>): NotificationPriority {
  // Errors are always critical
  if (notification.type === 'error') {
    return 'critical'
  }

  // Warnings with critical keywords are critical
  if (notification.type === 'warning') {
    const text = `${notification.title} ${notification.message ?? ''}`.toLowerCase()
    if (CRITICAL_WARNING_KEYWORDS.some((keyword) => text.includes(keyword))) {
      return 'critical'
    }
    return 'normal'
  }

  // Info about session start, client arrival = low priority
  if (notification.type === 'info') {
    const title = notification.title.toLowerCase()
    if (
      title.includes('session started') ||
      title.includes('new client') ||
      title.includes('arrived')
    ) {
      return 'low'
    }
  }

  // Achievements are normal (go to inbox, not toast)
  // Success and other info are normal
  return 'normal'
}

// Selectors
export const selectActiveModal = (state: UIStore) => state.activeModal
export const selectNotifications = (state: UIStore) => state.notifications
export const selectSchedulingMode = (state: UIStore) => state.schedulingMode
export const selectTutorialState = (state: UIStore) => state.tutorialState
export const selectInboxState = (state: UIStore) => ({
  notifications: state.inboxNotifications,
  unreadCount: state.unreadCount,
  isOpen: state.isInboxOpen,
})
