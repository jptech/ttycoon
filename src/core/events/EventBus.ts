import mitt, { type Emitter } from 'mitt'
import type { GameEventPayloads } from './GameEvents'

type Events = {
  [K in keyof GameEventPayloads]: GameEventPayloads[K]
}

/**
 * Central event bus for cross-system communication.
 * Uses mitt for lightweight pub/sub messaging.
 */
class EventBusClass {
  private emitter: Emitter<Events>
  private debugMode: boolean = false

  constructor() {
    this.emitter = mitt<Events>()
  }

  /**
   * Emit an event with payload
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    if (this.debugMode) {
      console.log(`[EventBus] ${String(event)}:`, payload)
    }
    this.emitter.emit(event, payload)
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): void {
    this.emitter.on(event, handler)
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): void {
    this.emitter.off(event, handler)
  }

  /**
   * Subscribe to all events (useful for debugging)
   */
  onAll(handler: (type: keyof Events, payload: Events[keyof Events]) => void): void {
    this.emitter.on('*', handler as (type: keyof Events, e: Events[keyof Events]) => void)
  }

  /**
   * Enable debug logging for all events
   */
  enableDebug(): void {
    this.debugMode = true
  }

  /**
   * Disable debug logging
   */
  disableDebug(): void {
    this.debugMode = false
  }

  /**
   * Clear all event listeners
   */
  clear(): void {
    this.emitter.all.clear()
  }
}

export const EventBus = new EventBusClass()
