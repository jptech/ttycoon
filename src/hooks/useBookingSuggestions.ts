import { useMemo, useState, useCallback } from 'react'
import { useGameStore } from '@/store'
import {
  generateBookingSuggestions,
  type BookingSuggestion,
  type GenerateSuggestionsResult,
} from '@/core/schedule'
import { BUILDINGS } from '@/data/buildings'

export interface UseBookingSuggestionsOptions {
  /** Maximum suggestions to generate */
  maxSuggestions?: number
  /** Days ahead to look for slots */
  daysAhead?: number
  /** Whether to include suggestions (can be disabled) */
  enabled?: boolean
}

export interface UseBookingSuggestionsResult {
  /** Generated suggestions */
  suggestions: BookingSuggestion[]
  /** Clients that couldn't be scheduled */
  unschedulableClients: GenerateSuggestionsResult['unschedulableClients']
  /** Number of suggestions */
  count: number
  /** Number of overdue suggestions */
  overdueCount: number
  /** Dismissed suggestion IDs (transient, resets on new day) */
  dismissedIds: Set<string>
  /** Dismiss a suggestion temporarily */
  dismissSuggestion: (id: string) => void
  /** Clear all dismissals */
  clearDismissals: () => void
  /** Get a suggestion by ID */
  getSuggestion: (id: string) => BookingSuggestion | undefined
}

/**
 * Hook to compute and manage booking suggestions
 */
export function useBookingSuggestions(
  options: UseBookingSuggestionsOptions = {}
): UseBookingSuggestionsResult {
  const { maxSuggestions = 10, daysAhead = 14, enabled = true } = options

  // Get game state
  const clients = useGameStore((state) => state.clients)
  const therapists = useGameStore((state) => state.therapists)
  const sessions = useGameStore((state) => state.sessions)
  const schedule = useGameStore((state) => state.schedule)
  const currentBuildingId = useGameStore((state) => state.currentBuildingId)
  const telehealthUnlocked = useGameStore((state) => state.telehealthUnlocked)
  const currentDay = useGameStore((state) => state.currentDay)
  const currentHour = useGameStore((state) => state.currentHour)
  const currentMinute = useGameStore((state) => state.currentMinute)

  // Track dismissed suggestions (transient state)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [lastDismissDay, setLastDismissDay] = useState<number>(currentDay)

  // Reset dismissals on new day
  if (currentDay !== lastDismissDay) {
    setDismissedIds(new Set())
    setLastDismissDay(currentDay)
  }

  // Generate suggestions
  const result = useMemo<GenerateSuggestionsResult>(() => {
    if (!enabled) {
      return { suggestions: [], unschedulableClients: [] }
    }

    const building = BUILDINGS[currentBuildingId] ?? Object.values(BUILDINGS)[0]

    return generateBookingSuggestions({
      clients,
      therapists,
      sessions,
      schedule,
      building,
      telehealthUnlocked,
      currentTime: {
        day: currentDay,
        hour: currentHour,
        minute: currentMinute,
      },
      maxSuggestions,
      daysAhead,
    })
  }, [
    enabled,
    clients,
    therapists,
    sessions,
    schedule,
    currentBuildingId,
    telehealthUnlocked,
    currentDay,
    currentHour,
    currentMinute,
    maxSuggestions,
    daysAhead,
  ])

  // Filter out dismissed suggestions
  const filteredSuggestions = useMemo(() => {
    return result.suggestions.filter((s) => !dismissedIds.has(s.id))
  }, [result.suggestions, dismissedIds])

  // Count overdue
  const overdueCount = useMemo(() => {
    return filteredSuggestions.filter((s) => s.urgency === 'overdue').length
  }, [filteredSuggestions])

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }, [])

  // Clear all dismissals
  const clearDismissals = useCallback(() => {
    setDismissedIds(new Set())
  }, [])

  // Get a suggestion by ID
  const getSuggestion = useCallback(
    (id: string) => {
      return result.suggestions.find((s) => s.id === id)
    },
    [result.suggestions]
  )

  return {
    suggestions: filteredSuggestions,
    unschedulableClients: result.unschedulableClients,
    count: filteredSuggestions.length,
    overdueCount,
    dismissedIds,
    dismissSuggestion,
    clearDismissals,
    getSuggestion,
  }
}
