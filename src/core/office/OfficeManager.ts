import type { Building, Session } from '@/core/types'

/**
 * Configuration for the office system
 */
export const OFFICE_CONFIG = {
  /** Cost to unlock telehealth capability */
  TELEHEALTH_UNLOCK_COST: 750,

  /** Bonus satisfaction for clients who prefer virtual */
  VIRTUAL_PREFERENCE_SATISFACTION_BONUS: 5,

  /** Daily rent is monthly rent / 30 */
  DAYS_PER_MONTH: 30,
} as const

/**
 * Office state tracking
 */
export interface OfficeState {
  currentBuildingId: string
  telehealthUnlocked: boolean
}

/**
 * Room availability result
 */
export interface RoomAvailability {
  totalRooms: number
  roomsInUse: number
  roomsAvailable: number
  canBookInPerson: boolean
  canBookVirtual: boolean
}

/**
 * Building upgrade result
 */
export interface UpgradeResult {
  success: boolean
  reason?: string
  newBuildingId?: string
  cost?: number
}

/**
 * Pure functions for managing the office/building system
 */
export const OfficeManager = {
  /**
   * Get current room availability for a specific time slot
   */
  getRoomAvailability(
    building: Building,
    activeSessions: Session[],
    day: number,
    hour: number
  ): RoomAvailability {
    // Count in-person sessions at this time
    const inPersonSessions = activeSessions.filter(
      (session) =>
        session.scheduledDay === day &&
        session.scheduledHour <= hour &&
        session.scheduledHour + Math.ceil(session.durationMinutes / 60) > hour &&
        !session.isVirtual &&
        session.status !== 'cancelled' &&
        session.status !== 'completed'
    )

    const roomsInUse = inPersonSessions.length
    const roomsAvailable = building.rooms - roomsInUse

    return {
      totalRooms: building.rooms,
      roomsInUse,
      roomsAvailable,
      canBookInPerson: roomsAvailable > 0,
      canBookVirtual: true, // Virtual sessions always allowed
    }
  },

  /**
   * Check if a new in-person session can be booked
   */
  canBookInPersonSession(
    building: Building,
    activeSessions: Session[],
    day: number,
    hour: number,
    durationMinutes: number
  ): { canBook: boolean; reason?: string } {
    // Check all hours the session would occupy
    const hoursNeeded = Math.ceil(durationMinutes / 60)

    for (let h = 0; h < hoursNeeded; h++) {
      const availability = this.getRoomAvailability(
        building,
        activeSessions,
        day,
        hour + h
      )

      if (!availability.canBookInPerson) {
        return {
          canBook: false,
          reason: `No rooms available at hour ${hour + h}`,
        }
      }
    }

    return { canBook: true }
  },

  /**
   * Check if telehealth can be unlocked
   */
  canUnlockTelehealth(
    currentBalance: number,
    alreadyUnlocked: boolean
  ): { canUnlock: boolean; reason?: string } {
    if (alreadyUnlocked) {
      return { canUnlock: false, reason: 'Telehealth already unlocked' }
    }

    if (currentBalance < OFFICE_CONFIG.TELEHEALTH_UNLOCK_COST) {
      return {
        canUnlock: false,
        reason: `Need $${OFFICE_CONFIG.TELEHEALTH_UNLOCK_COST - currentBalance} more`,
      }
    }

    return { canUnlock: true }
  },

  /**
   * Check if a building upgrade is possible
   */
  canUpgradeBuilding(
    currentBuilding: Building,
    targetBuilding: Building,
    currentBalance: number,
    practiceLevel: number
  ): { canUpgrade: boolean; reason?: string } {
    // Check practice level requirement
    if (practiceLevel < targetBuilding.requiredLevel) {
      return {
        canUpgrade: false,
        reason: `Requires practice level ${targetBuilding.requiredLevel}`,
      }
    }

    // Check if it's actually an upgrade
    if (targetBuilding.tier < currentBuilding.tier) {
      return {
        canUpgrade: false,
        reason: 'Cannot downgrade to a lower tier building',
      }
    }

    if (
      targetBuilding.tier === currentBuilding.tier &&
      targetBuilding.rooms <= currentBuilding.rooms
    ) {
      return {
        canUpgrade: false,
        reason: 'Target building is not an upgrade',
      }
    }

    // Check cost
    if (currentBalance < targetBuilding.upgradeCost) {
      return {
        canUpgrade: false,
        reason: `Need $${targetBuilding.upgradeCost - currentBalance} more`,
      }
    }

    return { canUpgrade: true }
  },

  /**
   * Process a building upgrade
   */
  processUpgrade(
    currentBuilding: Building,
    targetBuilding: Building,
    currentBalance: number,
    practiceLevel: number
  ): UpgradeResult {
    const check = this.canUpgradeBuilding(
      currentBuilding,
      targetBuilding,
      currentBalance,
      practiceLevel
    )

    if (!check.canUpgrade) {
      return { success: false, reason: check.reason }
    }

    return {
      success: true,
      newBuildingId: targetBuilding.id,
      cost: targetBuilding.upgradeCost,
    }
  },

  /**
   * Calculate daily rent for a building
   */
  getDailyRent(building: Building): number {
    return Math.round(building.monthlyRent / OFFICE_CONFIG.DAYS_PER_MONTH)
  },

  /**
   * Calculate room utilization percentage for a day
   */
  calculateDailyUtilization(
    building: Building,
    sessions: Session[],
    day: number,
    businessHours: { start: number; end: number } = { start: 8, end: 17 }
  ): number {
    const totalHours = businessHours.end - businessHours.start
    const totalRoomHours = building.rooms * totalHours

    if (totalRoomHours === 0) return 0

    // Count room-hours used by in-person sessions
    let usedRoomHours = 0
    const daySessions = sessions.filter(
      (s) => s.scheduledDay === day && !s.isVirtual && s.status !== 'cancelled'
    )

    for (const session of daySessions) {
      const sessionHours = session.durationMinutes / 60
      usedRoomHours += sessionHours
    }

    return Math.min(100, (usedRoomHours / totalRoomHours) * 100)
  },

  /**
   * Get room usage statistics
   */
  getRoomStats(
    building: Building,
    sessions: Session[],
    currentDay: number,
    daysToAnalyze: number = 7
  ): {
    averageUtilization: number
    peakDay: number
    peakUtilization: number
    totalInPersonSessions: number
    totalVirtualSessions: number
  } {
    let totalUtilization = 0
    let peakDay = currentDay
    let peakUtilization = 0
    let totalInPerson = 0
    let totalVirtual = 0

    for (let d = currentDay - daysToAnalyze + 1; d <= currentDay; d++) {
      const utilization = this.calculateDailyUtilization(building, sessions, d)
      totalUtilization += utilization

      if (utilization > peakUtilization) {
        peakUtilization = utilization
        peakDay = d
      }

      const daySessions = sessions.filter((s) => s.scheduledDay === d)
      totalInPerson += daySessions.filter((s) => !s.isVirtual).length
      totalVirtual += daySessions.filter((s) => s.isVirtual).length
    }

    return {
      averageUtilization: totalUtilization / daysToAnalyze,
      peakDay,
      peakUtilization,
      totalInPersonSessions: totalInPerson,
      totalVirtualSessions: totalVirtual,
    }
  },

  /**
   * Check if session type is available
   */
  getAvailableSessionTypes(
    building: Building,
    activeSessions: Session[],
    day: number,
    hour: number,
    telehealthUnlocked: boolean
  ): { inPerson: boolean; virtual: boolean } {
    const availability = this.getRoomAvailability(building, activeSessions, day, hour)

    return {
      inPerson: availability.canBookInPerson,
      virtual: telehealthUnlocked,
    }
  },

  /**
   * Get building capacity info for display
   */
  getBuildingInfo(building: Building): {
    name: string
    tier: number
    rooms: number
    monthlyRent: number
    dailyRent: number
  } {
    return {
      name: building.name,
      tier: building.tier,
      rooms: building.rooms,
      monthlyRent: building.monthlyRent,
      dailyRent: this.getDailyRent(building),
    }
  },

  /**
   * Calculate satisfaction bonus for virtual session preference
   */
  getVirtualPreferenceSatisfactionBonus(
    clientPrefersVirtual: boolean,
    isVirtualSession: boolean
  ): number {
    if (clientPrefersVirtual && isVirtualSession) {
      return OFFICE_CONFIG.VIRTUAL_PREFERENCE_SATISFACTION_BONUS
    }
    if (clientPrefersVirtual && !isVirtualSession) {
      return -OFFICE_CONFIG.VIRTUAL_PREFERENCE_SATISFACTION_BONUS
    }
    return 0
  },

  /**
   * Get upgrade recommendations based on utilization
   */
  getUpgradeRecommendation(
    building: Building,
    sessions: Session[],
    currentDay: number,
    availableBuildings: Building[]
  ): { shouldUpgrade: boolean; reason?: string; suggestedBuilding?: Building } {
    const stats = this.getRoomStats(building, sessions, currentDay)

    // If average utilization is over 80%, suggest upgrade
    if (stats.averageUtilization > 80) {
      const upgradeOptions = availableBuildings.filter(
        (b) => b.rooms > building.rooms
      )

      if (upgradeOptions.length > 0) {
        // Suggest the smallest upgrade that gives more room
        const suggested = upgradeOptions.sort((a, b) => a.rooms - b.rooms)[0]
        return {
          shouldUpgrade: true,
          reason: `Room utilization is ${Math.round(stats.averageUtilization)}%, consider upgrading`,
          suggestedBuilding: suggested,
        }
      }
    }

    return { shouldUpgrade: false }
  },
}
