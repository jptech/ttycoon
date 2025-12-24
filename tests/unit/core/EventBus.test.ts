import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBus, GameEvents } from '@/core/events'

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all listeners between tests
    EventBus.clear()
  })

  it('emits and receives events', () => {
    const handler = vi.fn()

    EventBus.on(GameEvents.DAY_STARTED, handler)
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 1 })

    expect(handler).toHaveBeenCalledWith({ dayNumber: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('allows unsubscribing from events', () => {
    const handler = vi.fn()

    EventBus.on(GameEvents.DAY_STARTED, handler)
    EventBus.off(GameEvents.DAY_STARTED, handler)
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 1 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple handlers for the same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    EventBus.on(GameEvents.MONEY_CHANGED, handler1)
    EventBus.on(GameEvents.MONEY_CHANGED, handler2)
    EventBus.emit(GameEvents.MONEY_CHANGED, {
      oldBalance: 100,
      newBalance: 200,
      reason: 'test',
    })

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('passes correct payload types', () => {
    const handler = vi.fn()

    EventBus.on(GameEvents.SESSION_COMPLETED, handler)
    EventBus.emit(GameEvents.SESSION_COMPLETED, {
      sessionId: 'session-1',
      quality: 0.8,
      payment: 150,
    })

    expect(handler).toHaveBeenCalledWith({
      sessionId: 'session-1',
      quality: 0.8,
      payment: 150,
    })
  })

  it('clears all listeners', () => {
    const handler = vi.fn()

    EventBus.on(GameEvents.DAY_STARTED, handler)
    EventBus.on(GameEvents.DAY_ENDED, handler)
    EventBus.clear()

    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 1 })
    EventBus.emit(GameEvents.DAY_ENDED, { dayNumber: 1 })

    expect(handler).not.toHaveBeenCalled()
  })
})
