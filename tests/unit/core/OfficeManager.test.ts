import { describe, it, expect } from 'vitest'
import { OfficeManager, OFFICE_CONFIG } from '@/core/office'
import type { Building, Session } from '@/core/types'

// ==================== TEST DATA ====================

const createBuilding = (overrides: Partial<Building> = {}): Building => ({
  id: 'test_building',
  name: 'Test Building',
  tier: 1,
  rooms: 2,
  monthlyRent: 3000,
  upgradeCost: 0,
  requiredLevel: 1,
  ...overrides,
})

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'test-session',
  therapistId: 'therapist-1',
  clientId: 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: false,
  scheduledDay: 1,
  scheduledHour: 10,
  durationMinutes: 50,
  status: 'scheduled',
  progress: 0,
  quality: 0,
  qualityModifiers: [],
  payment: 150,
  energyCost: 15,
  xpGained: 0,
  decisionsMade: [],
  therapistName: 'Dr. Test',
  clientName: 'Client A',
  ...overrides,
})

// ==================== ROOM AVAILABILITY ====================

describe('OfficeManager - Room Availability', () => {
  it('should return full availability when no sessions', () => {
    const building = createBuilding({ rooms: 3 })
    const sessions: Session[] = []

    const availability = OfficeManager.getRoomAvailability(building, sessions, 1, 10)

    expect(availability.totalRooms).toBe(3)
    expect(availability.roomsInUse).toBe(0)
    expect(availability.roomsAvailable).toBe(3)
    expect(availability.canBookInPerson).toBe(true)
    expect(availability.canBookVirtual).toBe(true)
  })

  it('should count in-person sessions as using rooms', () => {
    const building = createBuilding({ rooms: 2 })
    const sessions = [
      createSession({ id: 's1', scheduledDay: 1, scheduledHour: 10, isVirtual: false }),
      createSession({ id: 's2', scheduledDay: 1, scheduledHour: 10, isVirtual: false }),
    ]

    const availability = OfficeManager.getRoomAvailability(building, sessions, 1, 10)

    expect(availability.roomsInUse).toBe(2)
    expect(availability.roomsAvailable).toBe(0)
    expect(availability.canBookInPerson).toBe(false)
  })

  it('should not count virtual sessions as using rooms', () => {
    const building = createBuilding({ rooms: 2 })
    const sessions = [
      createSession({ id: 's1', scheduledDay: 1, scheduledHour: 10, isVirtual: true }),
      createSession({ id: 's2', scheduledDay: 1, scheduledHour: 10, isVirtual: true }),
    ]

    const availability = OfficeManager.getRoomAvailability(building, sessions, 1, 10)

    expect(availability.roomsInUse).toBe(0)
    expect(availability.roomsAvailable).toBe(2)
    expect(availability.canBookInPerson).toBe(true)
  })

  it('should not count cancelled sessions', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      createSession({ scheduledDay: 1, scheduledHour: 10, status: 'cancelled' }),
    ]

    const availability = OfficeManager.getRoomAvailability(building, sessions, 1, 10)

    expect(availability.roomsInUse).toBe(0)
    expect(availability.canBookInPerson).toBe(true)
  })

  it('should not count completed sessions', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      createSession({ scheduledDay: 1, scheduledHour: 10, status: 'completed' }),
    ]

    const availability = OfficeManager.getRoomAvailability(building, sessions, 1, 10)

    expect(availability.roomsInUse).toBe(0)
  })

  it('should handle multi-hour sessions correctly', () => {
    const building = createBuilding({ rooms: 1 })
    // 180-minute intensive session starting at hour 9
    const sessions = [
      createSession({ scheduledDay: 1, scheduledHour: 9, durationMinutes: 180 }),
    ]

    // Session spans hours 9, 10, 11
    expect(OfficeManager.getRoomAvailability(building, sessions, 1, 9).roomsInUse).toBe(1)
    expect(OfficeManager.getRoomAvailability(building, sessions, 1, 10).roomsInUse).toBe(1)
    expect(OfficeManager.getRoomAvailability(building, sessions, 1, 11).roomsInUse).toBe(1)
    expect(OfficeManager.getRoomAvailability(building, sessions, 1, 12).roomsInUse).toBe(0)
  })
})

// ==================== BOOKING CHECKS ====================

describe('OfficeManager - Booking Checks', () => {
  it('should allow booking when room available', () => {
    const building = createBuilding({ rooms: 2 })
    const sessions = [createSession({ scheduledDay: 1, scheduledHour: 10 })]

    const result = OfficeManager.canBookInPersonSession(building, sessions, 1, 10, 50)

    expect(result.canBook).toBe(true)
  })

  it('should reject booking when no rooms available', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [createSession({ scheduledDay: 1, scheduledHour: 10 })]

    const result = OfficeManager.canBookInPersonSession(building, sessions, 1, 10, 50)

    expect(result.canBook).toBe(false)
    expect(result.reason).toContain('No rooms available')
  })

  it('should check all hours for multi-hour sessions', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      // Room occupied at hour 11
      createSession({ scheduledDay: 1, scheduledHour: 11 }),
    ]

    // 3-hour session starting at 10 would need hours 10, 11, 12
    const result = OfficeManager.canBookInPersonSession(building, sessions, 1, 10, 180)

    expect(result.canBook).toBe(false)
    expect(result.reason).toContain('hour 11')
  })
})

// ==================== TELEHEALTH ====================

describe('OfficeManager - Telehealth', () => {
  it('should allow unlocking when sufficient balance', () => {
    const result = OfficeManager.canUnlockTelehealth(1000, false)

    expect(result.canUnlock).toBe(true)
  })

  it('should reject when already unlocked', () => {
    const result = OfficeManager.canUnlockTelehealth(1000, true)

    expect(result.canUnlock).toBe(false)
    expect(result.reason).toBe('Telehealth already unlocked')
  })

  it('should reject when insufficient balance', () => {
    const result = OfficeManager.canUnlockTelehealth(500, false)

    expect(result.canUnlock).toBe(false)
    expect(result.reason).toContain('Need $')
  })

  it('should calculate virtual preference satisfaction bonus', () => {
    // Client prefers virtual, gets virtual
    expect(OfficeManager.getVirtualPreferenceSatisfactionBonus(true, true))
      .toBe(OFFICE_CONFIG.VIRTUAL_PREFERENCE_SATISFACTION_BONUS)

    // Client prefers virtual, gets in-person
    expect(OfficeManager.getVirtualPreferenceSatisfactionBonus(true, false))
      .toBe(-OFFICE_CONFIG.VIRTUAL_PREFERENCE_SATISFACTION_BONUS)

    // Client doesn't prefer virtual
    expect(OfficeManager.getVirtualPreferenceSatisfactionBonus(false, true)).toBe(0)
    expect(OfficeManager.getVirtualPreferenceSatisfactionBonus(false, false)).toBe(0)
  })
})

// ==================== BUILDING UPGRADES ====================

describe('OfficeManager - Building Upgrades', () => {
  it('should allow valid upgrade', () => {
    const current = createBuilding({ id: 'small', tier: 1, rooms: 1 })
    const target = createBuilding({ id: 'large', tier: 2, rooms: 3, upgradeCost: 5000, requiredLevel: 2 })

    const result = OfficeManager.canUpgradeBuilding(current, target, 10000, 3)

    expect(result.canUpgrade).toBe(true)
  })

  it('should reject when practice level too low', () => {
    const current = createBuilding({ tier: 1, rooms: 1 })
    const target = createBuilding({ tier: 2, rooms: 3, requiredLevel: 3 })

    const result = OfficeManager.canUpgradeBuilding(current, target, 50000, 2)

    expect(result.canUpgrade).toBe(false)
    expect(result.reason).toContain('level 3')
  })

  it('should reject downgrade', () => {
    const current = createBuilding({ tier: 2, rooms: 3 })
    const target = createBuilding({ tier: 1, rooms: 2 })

    const result = OfficeManager.canUpgradeBuilding(current, target, 50000, 5)

    expect(result.canUpgrade).toBe(false)
    expect(result.reason).toContain('downgrade')
  })

  it('should reject same tier with fewer rooms', () => {
    const current = createBuilding({ tier: 2, rooms: 4 })
    const target = createBuilding({ tier: 2, rooms: 3 })

    const result = OfficeManager.canUpgradeBuilding(current, target, 50000, 5)

    expect(result.canUpgrade).toBe(false)
    expect(result.reason).toContain('not an upgrade')
  })

  it('should reject when insufficient balance', () => {
    const current = createBuilding({ tier: 1, rooms: 1 })
    const target = createBuilding({ tier: 2, rooms: 3, upgradeCost: 10000 })

    const result = OfficeManager.canUpgradeBuilding(current, target, 5000, 5)

    expect(result.canUpgrade).toBe(false)
    expect(result.reason).toContain('Need $5000 more')
  })

  it('should process valid upgrade', () => {
    const current = createBuilding({ id: 'small', tier: 1, rooms: 1 })
    const target = createBuilding({ id: 'large', tier: 2, rooms: 3, upgradeCost: 5000 })

    const result = OfficeManager.processUpgrade(current, target, 10000, 5)

    expect(result.success).toBe(true)
    expect(result.newBuildingId).toBe('large')
    expect(result.cost).toBe(5000)
  })
})

// ==================== RENT CALCULATION ====================

describe('OfficeManager - Rent', () => {
  it('should calculate daily rent from monthly', () => {
    const building = createBuilding({ monthlyRent: 3000 })

    const dailyRent = OfficeManager.getDailyRent(building)

    expect(dailyRent).toBe(100) // 3000 / 30
  })

  it('should round daily rent', () => {
    const building = createBuilding({ monthlyRent: 1000 })

    const dailyRent = OfficeManager.getDailyRent(building)

    expect(dailyRent).toBe(33) // 1000 / 30 ≈ 33.33 → 33
  })
})

// ==================== UTILIZATION ====================

describe('OfficeManager - Utilization', () => {
  it('should calculate daily utilization', () => {
    const building = createBuilding({ rooms: 2 })
    // 2 rooms × 9 hours = 18 room-hours available
    // 2 one-hour sessions = 2 room-hours used
    const sessions = [
      createSession({ id: 's1', scheduledDay: 1, durationMinutes: 60 }),
      createSession({ id: 's2', scheduledDay: 1, durationMinutes: 60 }),
    ]

    const utilization = OfficeManager.calculateDailyUtilization(building, sessions, 1)

    // 2 / 18 ≈ 11.1%
    expect(utilization).toBeCloseTo(11.1, 0)
  })

  it('should not count virtual sessions in utilization', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      createSession({ scheduledDay: 1, durationMinutes: 60, isVirtual: true }),
    ]

    const utilization = OfficeManager.calculateDailyUtilization(building, sessions, 1)

    expect(utilization).toBe(0)
  })

  it('should not count cancelled sessions', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      createSession({ scheduledDay: 1, status: 'cancelled' }),
    ]

    const utilization = OfficeManager.calculateDailyUtilization(building, sessions, 1)

    expect(utilization).toBe(0)
  })

  it('should get room stats over multiple days', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [
      createSession({ id: 's1', scheduledDay: 1, durationMinutes: 60 }),
      createSession({ id: 's2', scheduledDay: 2, durationMinutes: 60 }),
      createSession({ id: 's3', scheduledDay: 3, durationMinutes: 60, isVirtual: true }),
    ]

    const stats = OfficeManager.getRoomStats(building, sessions, 3, 3)

    expect(stats.totalInPersonSessions).toBe(2)
    expect(stats.totalVirtualSessions).toBe(1)
    expect(stats.averageUtilization).toBeGreaterThan(0)
  })
})

// ==================== SESSION TYPES ====================

describe('OfficeManager - Session Types', () => {
  it('should allow both types when room available and telehealth unlocked', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions: Session[] = []

    const types = OfficeManager.getAvailableSessionTypes(building, sessions, 1, 10, true)

    expect(types.inPerson).toBe(true)
    expect(types.virtual).toBe(true)
  })

  it('should only allow virtual when rooms full', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [createSession({ scheduledDay: 1, scheduledHour: 10 })]

    const types = OfficeManager.getAvailableSessionTypes(building, sessions, 1, 10, true)

    expect(types.inPerson).toBe(false)
    expect(types.virtual).toBe(true)
  })

  it('should only allow in-person when telehealth not unlocked', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions: Session[] = []

    const types = OfficeManager.getAvailableSessionTypes(building, sessions, 1, 10, false)

    expect(types.inPerson).toBe(true)
    expect(types.virtual).toBe(false)
  })
})

// ==================== BUILDING INFO ====================

describe('OfficeManager - Building Info', () => {
  it('should return building info', () => {
    const building = createBuilding({
      name: 'Test Office',
      tier: 2,
      rooms: 3,
      monthlyRent: 6000,
    })

    const info = OfficeManager.getBuildingInfo(building)

    expect(info.name).toBe('Test Office')
    expect(info.tier).toBe(2)
    expect(info.rooms).toBe(3)
    expect(info.monthlyRent).toBe(6000)
    expect(info.dailyRent).toBe(200)
  })
})

// ==================== UPGRADE RECOMMENDATIONS ====================

describe('OfficeManager - Upgrade Recommendations', () => {
  it('should recommend upgrade when utilization high', () => {
    const building = createBuilding({ rooms: 1 })
    // Create intensive sessions that consume the entire day
    // 9 hours of business * 7 days = 63 room-hours
    // Need > 50.4 hours (80%)
    // Use 9 hours per day = 100% utilization
    const sessions: Session[] = []
    for (let d = 1; d <= 7; d++) {
      // One long 9-hour session per day (540 minutes)
      sessions.push(createSession({
        id: `s-${d}`,
        scheduledDay: d,
        scheduledHour: 8,
        durationMinutes: 540, // 9 hours
      }))
    }

    const availableBuildings = [
      building,
      createBuilding({ id: 'larger', rooms: 3 }),
    ]

    const recommendation = OfficeManager.getUpgradeRecommendation(
      building,
      sessions,
      7,
      availableBuildings
    )

    expect(recommendation.shouldUpgrade).toBe(true)
    expect(recommendation.suggestedBuilding?.id).toBe('larger')
  })

  it('should not recommend upgrade when utilization low', () => {
    const building = createBuilding({ rooms: 3 })
    const sessions = [createSession({ scheduledDay: 1 })]

    const recommendation = OfficeManager.getUpgradeRecommendation(
      building,
      sessions,
      1,
      []
    )

    expect(recommendation.shouldUpgrade).toBe(false)
  })
})

// ==================== CONFIG ====================

describe('OFFICE_CONFIG', () => {
  it('should have valid configuration values', () => {
    expect(OFFICE_CONFIG.TELEHEALTH_UNLOCK_COST).toBeGreaterThan(0)
    expect(OFFICE_CONFIG.VIRTUAL_PREFERENCE_SATISFACTION_BONUS).toBeGreaterThan(0)
    expect(OFFICE_CONFIG.DAYS_PER_MONTH).toBe(30)
  })
})
