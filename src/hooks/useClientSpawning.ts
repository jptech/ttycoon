import { useEffect, useRef, useCallback } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { EventBus, GameEvents } from '@/core/events'
import { ClientManager } from '@/core/clients'
import { getClientSpawnChance, getClientSpawnAttempts, getSessionRate } from '@/data/clientGeneration'

interface UseClientSpawningOptions {
  /** Whether spawning is enabled */
  enabled?: boolean
  /** Called when a client arrives */
  onClientArrived?: (clientId: string, reason: string) => void
  /** Called when a client drops out */
  onClientDropped?: (clientId: string, reason: string) => void
}

/**
 * Hook to manage daily client spawning and waiting list processing
 */
export function useClientSpawning(options: UseClientSpawningOptions = {}) {
  const { enabled = true, onClientArrived, onClientDropped } = options

  const addClient = useGameStore((state) => state.addClient)
  const updateClient = useGameStore((state) => state.updateClient)
  const removeFromWaitingList = useGameStore((state) => state.removeFromWaitingList)
  const addNotification = useUIStore((state) => state.addNotification)

  // Store callbacks in ref to avoid recreation
  const callbacksRef = useRef({ onClientArrived, onClientDropped })
  useEffect(() => {
    callbacksRef.current = { onClientArrived, onClientDropped }
  })

  // Track last processed day to avoid duplicate processing
  const lastProcessedDayRef = useRef(0)

  /**
   * Spawn new clients based on current game state
   */
  const spawnClients = useCallback(() => {
    const state = useGameStore.getState()
    const { currentDay, reputation, practiceLevel, activePanels, clients } = state

    // Don't spawn on day 1 (initial clients are seeded)
    if (currentDay < 2) return

    const spawnChance = getClientSpawnChance(currentDay, reputation)
    const attempts = getClientSpawnAttempts(currentDay)

    let spawnedCount = 0

    for (let i = 0; i < attempts; i++) {
      if (Math.random() < spawnChance) {
        const isPrivatePay = Math.random() < 0.3
        const sessionRate = getSessionRate(isPrivatePay)
        const result = ClientManager.generateClient(
          currentDay,
          isPrivatePay ? [] : activePanels,
          sessionRate,
          Date.now() + i + clients.length,
          { practiceLevel }
        )

        addClient(result.client)
        spawnedCount++

        callbacksRef.current.onClientArrived?.(result.client.id, result.reason)
      }
    }

    if (spawnedCount > 0) {
      addNotification({
        type: 'info',
        title: spawnedCount === 1 ? 'New Client' : 'New Clients',
        message:
          spawnedCount === 1
            ? 'A new client is waiting for an appointment'
            : `${spawnedCount} new clients are waiting for appointments`,
      })
    }
  }, [addClient, addNotification])

  /**
   * Process waiting list - update satisfaction and handle dropouts
   */
  const processWaitingList = useCallback(() => {
    const state = useGameStore.getState()
    const { currentDay, clients, waitingList } = state

    // Get waiting clients
    const waitingClients = clients.filter(
      (c) => waitingList.includes(c.id) && c.status === 'waiting'
    )

    if (waitingClients.length === 0) return

    const result = ClientManager.processWaitingList(waitingClients, currentDay)

    // Update remaining clients
    for (const client of result.remainingClients) {
      if (client.status === 'waiting') {
        updateClient(client.id, {
          satisfaction: client.satisfaction,
          daysWaiting: client.daysWaiting,
        })
      }
    }

    // Handle dropped clients
    for (const droppedClient of result.droppedClients) {
      updateClient(droppedClient.id, { status: 'dropped' })
      removeFromWaitingList(droppedClient.id)

      callbacksRef.current.onClientDropped?.(
        droppedClient.id,
        droppedClient.daysWaiting >= droppedClient.maxWaitDays
          ? 'Waited too long'
          : 'Lost patience'
      )
    }

    if (result.droppedClients.length > 0) {
      addNotification({
        type: 'warning',
        title:
          result.droppedClients.length === 1
            ? 'Client Left'
            : 'Clients Left',
        message:
          result.droppedClients.length === 1
            ? 'A client left after waiting too long'
            : `${result.droppedClients.length} clients left after waiting too long`,
      })
    }
  }, [updateClient, removeFromWaitingList, addNotification])

  /**
   * Handle day start - spawn clients and process waiting list
   */
  const handleDayStart = useCallback(
    (data: { dayNumber: number }) => {
      // Prevent duplicate processing
      if (data.dayNumber <= lastProcessedDayRef.current) return
      lastProcessedDayRef.current = data.dayNumber

      // Process waiting list first (decay from previous day)
      processWaitingList()

      // Then spawn new clients
      spawnClients()
    },
    [processWaitingList, spawnClients]
  )

  // Subscribe to DAY_STARTED events
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = EventBus.on(GameEvents.DAY_STARTED, handleDayStart)

    return unsubscribe
  }, [enabled, handleDayStart])

  /**
   * Manually trigger client spawning (for testing/debugging)
   */
  const forceSpawn = useCallback(() => {
    spawnClients()
  }, [spawnClients])

  /**
   * Get current spawn statistics
   */
  const getSpawnStats = useCallback(() => {
    const state = useGameStore.getState()
    const { currentDay, reputation, clients, waitingList } = state

    return {
      spawnChance: getClientSpawnChance(currentDay, reputation),
      spawnAttempts: getClientSpawnAttempts(currentDay),
      waitingCount: waitingList.length,
      totalClients: clients.length,
      droppedCount: clients.filter((c) => c.status === 'dropped').length,
    }
  }, [])

  return {
    forceSpawn,
    getSpawnStats,
    processWaitingList,
  }
}
