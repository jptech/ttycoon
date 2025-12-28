import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/store/uiStore'

describe('Notification Inbox', () => {
  beforeEach(() => {
    // Reset inbox state before each test
    useUIStore.setState({
      inboxNotifications: [],
      unreadCount: 0,
      isInboxOpen: false,
      notifications: [],
      pendingBatches: new Map(),
    })
  })

  describe('addToInbox', () => {
    it('adds notification to inbox with timestamp', () => {
      const before = Date.now()
      useUIStore.getState().addToInbox({
        type: 'success',
        title: 'Test Notification',
        message: 'Test message',
      })
      const after = Date.now()

      const state = useUIStore.getState()
      expect(state.inboxNotifications.length).toBe(1)
      expect(state.inboxNotifications[0].title).toBe('Test Notification')
      expect(state.inboxNotifications[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(state.inboxNotifications[0].timestamp).toBeLessThanOrEqual(after)
      expect(state.inboxNotifications[0].isRead).toBe(false)
    })

    it('increments unreadCount for normal priority', () => {
      useUIStore.getState().addToInbox(
        { type: 'success', title: 'Test' },
        'normal'
      )

      expect(useUIStore.getState().unreadCount).toBe(1)
    })

    it('increments unreadCount for critical priority', () => {
      useUIStore.getState().addToInbox(
        { type: 'error', title: 'Error' },
        'critical'
      )

      expect(useUIStore.getState().unreadCount).toBe(1)
    })

    it('does NOT increment unreadCount for low priority', () => {
      useUIStore.getState().addToInbox(
        { type: 'info', title: 'Session Started' },
        'low'
      )

      expect(useUIStore.getState().unreadCount).toBe(0)
    })

    it('respects max inbox limit (FIFO)', () => {
      // Add 105 notifications
      for (let i = 0; i < 105; i++) {
        useUIStore.getState().addToInbox({
          type: 'success',
          title: `Notification ${i}`,
        })
      }

      const state = useUIStore.getState()
      expect(state.inboxNotifications.length).toBe(100)
      // First 5 should be removed (FIFO)
      expect(state.inboxNotifications[0].title).toBe('Notification 5')
      expect(state.inboxNotifications[99].title).toBe('Notification 104')
    })
  })

  describe('Priority Classification', () => {
    it('classifies errors as critical', () => {
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Error occurred',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('critical')
      // Critical should also show as toast
      expect(state.notifications.length).toBe(1)
    })

    it('classifies warnings with burnout keyword as critical', () => {
      useUIStore.getState().addNotification({
        type: 'warning',
        title: 'Burnout Risk',
        message: 'Therapist is at risk of burnout',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('critical')
    })

    it('classifies warnings with dropped keyword as critical', () => {
      useUIStore.getState().addNotification({
        type: 'warning',
        title: 'Client Dropped',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('critical')
    })

    it('classifies regular warnings as normal', () => {
      useUIStore.getState().addNotification({
        type: 'warning',
        title: 'Low Energy',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('normal')
      // Normal should NOT show as toast
      expect(state.notifications.length).toBe(0)
    })

    it('classifies session started as low priority', () => {
      useUIStore.getState().addNotification({
        type: 'info',
        title: 'Session Started',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('low')
      expect(state.unreadCount).toBe(0) // Low priority doesn't increment
    })

    it('classifies new client as low priority', () => {
      useUIStore.getState().addNotification({
        type: 'info',
        title: 'New Client',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('low')
    })

    it('classifies success as normal priority', () => {
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Session Booked',
      })

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].priority).toBe('normal')
      expect(state.notifications.length).toBe(0) // Not critical, no toast
    })
  })

  describe('markAsRead', () => {
    it('marks notification as read', () => {
      useUIStore.getState().addToInbox(
        { type: 'success', title: 'Test' },
        'normal'
      )

      const notificationId = useUIStore.getState().inboxNotifications[0].id
      useUIStore.getState().markAsRead(notificationId)

      const state = useUIStore.getState()
      expect(state.inboxNotifications[0].isRead).toBe(true)
    })

    it('decrements unreadCount when marking normal priority as read', () => {
      useUIStore.getState().addToInbox(
        { type: 'success', title: 'Test' },
        'normal'
      )
      expect(useUIStore.getState().unreadCount).toBe(1)

      const notificationId = useUIStore.getState().inboxNotifications[0].id
      useUIStore.getState().markAsRead(notificationId)

      expect(useUIStore.getState().unreadCount).toBe(0)
    })

    it('does NOT decrement unreadCount for low priority', () => {
      useUIStore.getState().addToInbox(
        { type: 'info', title: 'Session Started' },
        'low'
      )
      expect(useUIStore.getState().unreadCount).toBe(0)

      const notificationId = useUIStore.getState().inboxNotifications[0].id
      useUIStore.getState().markAsRead(notificationId)

      expect(useUIStore.getState().unreadCount).toBe(0)
    })

    it('does nothing if notification already read', () => {
      useUIStore.getState().addToInbox(
        { type: 'success', title: 'Test' },
        'normal'
      )

      const notificationId = useUIStore.getState().inboxNotifications[0].id
      useUIStore.getState().markAsRead(notificationId)
      useUIStore.getState().markAsRead(notificationId) // Second call

      expect(useUIStore.getState().unreadCount).toBe(0) // Should still be 0
    })

    it('does nothing for non-existent notification', () => {
      useUIStore.getState().addToInbox(
        { type: 'success', title: 'Test' },
        'normal'
      )

      useUIStore.getState().markAsRead('non-existent-id')

      expect(useUIStore.getState().unreadCount).toBe(1) // Unchanged
    })
  })

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      useUIStore.getState().addToInbox({ type: 'success', title: 'Test 1' }, 'normal')
      useUIStore.getState().addToInbox({ type: 'success', title: 'Test 2' }, 'normal')
      useUIStore.getState().addToInbox({ type: 'success', title: 'Test 3' }, 'normal')

      useUIStore.getState().markAllAsRead()

      const state = useUIStore.getState()
      expect(state.inboxNotifications.every((n) => n.isRead)).toBe(true)
      expect(state.unreadCount).toBe(0)
    })
  })

  describe('clearInbox', () => {
    it('removes all notifications and resets unread count', () => {
      useUIStore.getState().addToInbox({ type: 'success', title: 'Test 1' }, 'normal')
      useUIStore.getState().addToInbox({ type: 'success', title: 'Test 2' }, 'normal')

      useUIStore.getState().clearInbox()

      const state = useUIStore.getState()
      expect(state.inboxNotifications.length).toBe(0)
      expect(state.unreadCount).toBe(0)
    })
  })

  describe('toggleInbox', () => {
    it('toggles inbox open state', () => {
      expect(useUIStore.getState().isInboxOpen).toBe(false)

      useUIStore.getState().toggleInbox()
      expect(useUIStore.getState().isInboxOpen).toBe(true)

      useUIStore.getState().toggleInbox()
      expect(useUIStore.getState().isInboxOpen).toBe(false)
    })
  })

  describe('setInboxOpen', () => {
    it('sets inbox open state directly', () => {
      useUIStore.getState().setInboxOpen(true)
      expect(useUIStore.getState().isInboxOpen).toBe(true)

      useUIStore.getState().setInboxOpen(false)
      expect(useUIStore.getState().isInboxOpen).toBe(false)
    })
  })

  describe('addNotification routing', () => {
    it('routes critical notifications to both toast and inbox', () => {
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Critical Error',
      })

      const state = useUIStore.getState()
      expect(state.notifications.length).toBe(1) // Toast
      expect(state.inboxNotifications.length).toBe(1) // Inbox
    })

    it('routes normal notifications to inbox only (no toast)', () => {
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Session Booked',
      })

      const state = useUIStore.getState()
      expect(state.notifications.length).toBe(0) // No toast
      expect(state.inboxNotifications.length).toBe(1) // Inbox only
    })

    it('routes low priority notifications to inbox only', () => {
      useUIStore.getState().addNotification({
        type: 'info',
        title: 'Session Started',
      })

      const state = useUIStore.getState()
      expect(state.notifications.length).toBe(0) // No toast
      expect(state.inboxNotifications.length).toBe(1) // Inbox only
      expect(state.unreadCount).toBe(0) // Low priority doesn't increment
    })
  })
})
