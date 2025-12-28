import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { SaveManager } from '@/core/engine'
import { TherapistManager } from '@/core/therapists'

describe('QoL Settings', () => {
  beforeEach(() => {
    // Reset stores before each test
    const playerTherapist = TherapistManager.createPlayerTherapist('Test Therapist', 'LPC', 'CBT')
    useGameStore.getState().newGame('Test Practice', playerTherapist)
  })

  describe('Initial State', () => {
    it('showSessionSummaryModal defaults to true', () => {
      const state = useGameStore.getState()
      expect(state.showSessionSummaryModal).toBe(true)
    })

    it('showDaySummaryModal defaults to true', () => {
      const state = useGameStore.getState()
      expect(state.showDaySummaryModal).toBe(true)
    })

    it('autoApplyDecisions defaults to false', () => {
      const state = useGameStore.getState()
      expect(state.autoApplyDecisions).toBe(false)
    })
  })

  describe('Settings Actions', () => {
    it('setShowSessionSummaryModal updates state', () => {
      useGameStore.getState().setShowSessionSummaryModal(false)
      expect(useGameStore.getState().showSessionSummaryModal).toBe(false)

      useGameStore.getState().setShowSessionSummaryModal(true)
      expect(useGameStore.getState().showSessionSummaryModal).toBe(true)
    })

    it('setShowDaySummaryModal updates state', () => {
      useGameStore.getState().setShowDaySummaryModal(false)
      expect(useGameStore.getState().showDaySummaryModal).toBe(false)

      useGameStore.getState().setShowDaySummaryModal(true)
      expect(useGameStore.getState().showDaySummaryModal).toBe(true)
    })

    it('setAutoApplyDecisions updates state', () => {
      useGameStore.getState().setAutoApplyDecisions(true)
      expect(useGameStore.getState().autoApplyDecisions).toBe(true)

      useGameStore.getState().setAutoApplyDecisions(false)
      expect(useGameStore.getState().autoApplyDecisions).toBe(false)
    })
  })

  describe('getState includes settings', () => {
    it('includes all QoL settings in getState()', () => {
      useGameStore.getState().setShowSessionSummaryModal(false)
      useGameStore.getState().setShowDaySummaryModal(false)
      useGameStore.getState().setAutoApplyDecisions(true)

      const state = useGameStore.getState().getState()

      expect(state.showSessionSummaryModal).toBe(false)
      expect(state.showDaySummaryModal).toBe(false)
      expect(state.autoApplyDecisions).toBe(true)
    })
  })

  describe('Remember Decision', () => {
    it('rememberDecision stores eventId and choiceIndex', () => {
      useGameStore.getState().rememberDecision('event_1', 0)
      useGameStore.getState().rememberDecision('event_2', 1)

      const state = useGameStore.getState()
      expect(state.rememberedDecisions['event_1']).toBe(0)
      expect(state.rememberedDecisions['event_2']).toBe(1)
    })

    it('rememberDecision overwrites previous choice', () => {
      useGameStore.getState().rememberDecision('event_1', 0)
      useGameStore.getState().rememberDecision('event_1', 2)

      const state = useGameStore.getState()
      expect(state.rememberedDecisions['event_1']).toBe(2)
    })
  })
})

describe('Notification Batching', () => {
  beforeEach(() => {
    useUIStore.setState({
      notifications: [],
      pendingBatches: new Map(),
      inboxNotifications: [],
      unreadCount: 0,
    })
  })

  it('queueNotification creates a pending batch', () => {
    const { queueNotification, pendingBatches } = useUIStore.getState()

    queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items',
    })

    expect(pendingBatches.has('test_key')).toBe(true)
    expect(pendingBatches.get('test_key')?.count).toBe(1)
  })

  it('queueNotification increments count for same key', () => {
    const { queueNotification, pendingBatches } = useUIStore.getState()

    queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items',
    })

    queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items',
    })

    expect(pendingBatches.get('test_key')?.count).toBe(2)
  })

  it('flushBatch creates single notification for count 1', async () => {
    const { queueNotification, flushBatch } = useUIStore.getState()

    queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items',
    }, 'Single item message')

    flushBatch('test_key')

    // Success notifications are normal priority → inbox only (no toast)
    const { inboxNotifications, pendingBatches } = useUIStore.getState()
    expect(inboxNotifications.length).toBe(1)
    expect(inboxNotifications[0].message).toBe('Single item message')
    expect(pendingBatches.has('test_key')).toBe(false)
  })

  it('flushBatch creates grouped notification for count > 1', () => {
    const store = useUIStore.getState()

    store.queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items completed',
    })

    store.queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items completed',
    })

    store.queueNotification('test_key', {
      type: 'success',
      title: 'Test',
      message: 'items completed',
    })

    store.flushBatch('test_key')

    // Success notifications are normal priority → inbox only (no toast)
    const { inboxNotifications, pendingBatches } = useUIStore.getState()
    expect(inboxNotifications.length).toBe(1)
    expect(inboxNotifications[0].message).toBe('3 items completed')
    expect(pendingBatches.has('test_key')).toBe(false)
  })
})

describe('Save Migration', () => {
  it('migrates old saves to include QoL settings', () => {
    // Simulate old save format (version 1, missing new settings)
    const oldSave = {
      version: 1,
      timestamp: Date.now(),
      state: {
        practiceName: 'Test',
        saveVersion: 1,
        currentDay: 5,
        currentHour: 10,
        currentMinute: 30,
        gameSpeed: 1,
        isPaused: false,
        pauseReasons: [],
        balance: 5000,
        pendingClaims: [],
        insuranceMultiplier: 1.0,
        transactionHistory: [],
        reputationLog: [],
        reputation: 50,
        practiceLevel: 1,
        therapists: [],
        clients: [],
        sessions: [],
        schedule: {},
        waitingList: [],
        activeTrainings: [],
        currentBuildingId: 'starter_suite',
        telehealthUnlocked: false,
        activePanels: [],
        hiringCapacityBonus: 0,
        eventCooldowns: {},
        activeModifiers: [],
        rememberedDecisions: {},
        achievedMilestones: [],
        autoResolveSessions: false,
        soundEnabled: true,
        musicEnabled: true,
        // Note: missing showSessionSummaryModal, showDaySummaryModal, autoApplyDecisions
      },
    }

    localStorage.setItem('therapy_tycoon_save', JSON.stringify(oldSave))

    // Load should migrate
    const loaded = SaveManager.load()
    expect(loaded).toBe(true)

    const state = useGameStore.getState()
    expect(state.showSessionSummaryModal).toBe(true)
    expect(state.showDaySummaryModal).toBe(true)
    expect(state.autoApplyDecisions).toBe(false)

    localStorage.removeItem('therapy_tycoon_save')
  })
})
