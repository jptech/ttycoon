import { useGameStore } from '@/store/gameStore'
import type { GameState } from '@/core/types'
import { EventBus, GameEvents } from '@/core/events'
import { ScheduleManager } from '@/core/schedule'
import { DEFAULT_WORK_SCHEDULE } from '@/core/therapists'
import { DEFAULT_BUILDING_UPGRADE_STATE } from '@/core/types/office'

const SESSIONS_RETENTION_DAYS = 14
const SCHEDULE_PAST_DAYS = 14
const SCHEDULE_FUTURE_DAYS = 30

const SAVE_VERSION = 5
const STORAGE_KEY = 'therapy_tycoon_save'

interface SaveData {
  version: number
  timestamp: number
  state: GameState
}

/**
 * Save/Load manager for persisting game state
 */
export const SaveManager = {
  /**
   * Save current game state to localStorage
   */
  save(): boolean {
    try {
      const state = useGameStore.getState().getState()

      const saveData: SaveData = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        state: this.serializeState(state),
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
      EventBus.emit(GameEvents.GAME_SAVED, { timestamp: saveData.timestamp })
      console.log('[SaveManager] Game saved successfully')
      return true
    } catch (error) {
      console.error('[SaveManager] Failed to save game:', error)
      return false
    }
  },

  /**
   * Load game state from localStorage
   */
  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        console.log('[SaveManager] No save data found')
        return false
      }

      const saveData: SaveData = JSON.parse(raw)

      // Migrate if needed
      const migratedState = this.migrate(saveData)

      // Apply to store
      useGameStore.getState().loadState(migratedState)

      console.log('[SaveManager] Game loaded successfully')
      return true
    } catch (error) {
      console.error('[SaveManager] Failed to load game:', error)
      return false
    }
  },

  /**
   * Check if a save exists
   */
  hasSave(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
  },

  /**
   * Get save metadata without loading the full state
   */
  getSaveInfo(): { timestamp: number; practiceName: string; day: number } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null

      const saveData: SaveData = JSON.parse(raw)
      return {
        timestamp: saveData.timestamp,
        practiceName: saveData.state.practiceName,
        day: saveData.state.currentDay,
      }
    } catch {
      return null
    }
  },

  /**
   * Delete save data
   */
  deleteSave(): void {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[SaveManager] Save deleted')
  },

  /**
   * Serialize state for saving (prune unnecessary data)
   */
  serializeState(state: GameState): GameState {
    const currentDay = state.currentDay

    const activeClientIds = new Set(
      state.clients
        .filter((c) => c.status === 'waiting' || c.status === 'in_treatment')
        .map((c) => c.id)
    )

    // Persist:
    // - all scheduled/in-progress sessions
    // - last ~2 weeks of session history
    // - ALL session history for active clients (waiting/in_treatment)
    const sessionsToSave = state.sessions.filter((s) => {
      if (s.status === 'scheduled' || s.status === 'in_progress') return true
      if (activeClientIds.has(s.clientId)) return true
      return s.scheduledDay >= currentDay - SESSIONS_RETENTION_DAYS
    })

    // Rebuild schedule from sessions so we persist past schedule data even if runtime
    // schedule is missing/stale.
    const rebuiltSchedule = ScheduleManager.buildScheduleFromSessions(sessionsToSave)

    return {
      ...state,
      sessions: sessionsToSave,
      // Prune old transactions (keep last 30 days)
      transactionHistory: state.transactionHistory.filter((t) => t.day >= currentDay - 30),
      // Persist past schedule history and near-future schedule
      schedule: this.pruneSchedule(rebuiltSchedule, currentDay),
    }
  },

  /**
   * Prune old schedule data
   */
  pruneSchedule(
    schedule: GameState['schedule'],
    currentDay: number
  ): GameState['schedule'] {
    const pruned: GameState['schedule'] = {}

    for (const day in schedule) {
      const dayNum = parseInt(day)
      if (dayNum >= currentDay - SCHEDULE_PAST_DAYS && dayNum <= currentDay + SCHEDULE_FUTURE_DAYS) {
        pruned[dayNum] = schedule[dayNum]
      }
    }

    return pruned
  },

  /**
   * Migrate save data to current version
   */
  migrate(saveData: SaveData): GameState {
    let state = saveData.state
    let version = saveData.version

    // Version 0 -> 1: Initial version, add any missing fields
    if (version < 1) {
      state = {
        ...state,
        insuranceMultiplier: state.insuranceMultiplier ?? 1.0,
        soundEnabled: state.soundEnabled ?? true,
        musicEnabled: state.musicEnabled ?? true,
        autoResolveSessions: state.autoResolveSessions ?? false,
      }
      version = 1
    }

    // Version 1 -> 2: Add QoL settings
    if (version < 2) {
      state = {
        ...state,
        showSessionSummaryModal: state.showSessionSummaryModal ?? true,
        showDaySummaryModal: state.showDaySummaryModal ?? true,
        autoApplyDecisions: state.autoApplyDecisions ?? false,
      }
      version = 2
    }

    // Version 2 -> 3: Add work schedule to therapists
    if (version < 3) {
      state = {
        ...state,
        therapists: state.therapists.map((t) => ({
          ...t,
          workSchedule: t.workSchedule ?? { ...DEFAULT_WORK_SCHEDULE },
        })),
      }
      version = 3
    }

    // Version 3 -> 4: Convert lunchBreakHour to breakHours array
    if (version < 4) {
      state = {
        ...state,
        therapists: state.therapists.map((t) => {
          const oldSchedule = t.workSchedule as {
            workStartHour?: number
            workEndHour?: number
            lunchBreakHour?: number | null
            breakHours?: number[]
          } | undefined

          // If already has breakHours, use it
          if (oldSchedule?.breakHours !== undefined) {
            return t
          }

          // Convert old lunchBreakHour to new breakHours array
          const breakHours: number[] =
            oldSchedule?.lunchBreakHour !== null && oldSchedule?.lunchBreakHour !== undefined
              ? [oldSchedule.lunchBreakHour]
              : []

          return {
            ...t,
            workSchedule: {
              workStartHour: oldSchedule?.workStartHour ?? 8,
              workEndHour: oldSchedule?.workEndHour ?? 17,
              breakHours,
            },
          }
        }),
      }
      version = 4
    }

    // Version 4 -> 5: Add buildingUpgrades
    if (version < 5) {
      state = {
        ...state,
        buildingUpgrades: (state as any).buildingUpgrades ?? { ...DEFAULT_BUILDING_UPGRADE_STATE },
      }
      version = 5
    }

    // Future migrations here...
    // if (version < 6) { ... }

    return state
  },

  /**
   * Export save as downloadable file
   */
  exportSave(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      console.warn('[SaveManager] No save to export')
      return
    }

    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `therapy_tycoon_save_${Date.now()}.json`
    a.click()

    URL.revokeObjectURL(url)
    console.log('[SaveManager] Save exported')
  },

  /**
   * Import save from file
   */
  async importSave(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      const saveData: SaveData = JSON.parse(text)

      // Validate structure
      if (!saveData.version || !saveData.state) {
        throw new Error('Invalid save file format')
      }

      localStorage.setItem(STORAGE_KEY, text)
      return this.load()
    } catch (error) {
      console.error('[SaveManager] Failed to import save:', error)
      return false
    }
  },

  /**
   * Enable auto-save at regular intervals
   */
  enableAutoSave(intervalMs: number = 60000): () => void {
    const intervalId = setInterval(() => {
      this.save()
    }, intervalMs)

    return () => clearInterval(intervalId)
  },
}
