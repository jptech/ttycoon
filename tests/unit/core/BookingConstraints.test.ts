import { describe, it, expect } from 'vitest'
import { canBookSessionType } from '@/core/schedule/BookingConstraints'
import type { Building, Session } from '@/core/types'

const createBuilding = (overrides: Partial<Building> = {}): Building => ({
  id: 'test_building',
  name: 'Test Building',
  tier: 1,
  rooms: 1,
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

describe('canBookSessionType', () => {
  it('rejects virtual when telehealth is locked', () => {
    const building = createBuilding({ rooms: 1 })
    const result = canBookSessionType({
      building,
      sessions: [],
      telehealthUnlocked: false,
      isVirtual: true,
      day: 1,
      hour: 10,
      durationMinutes: 50,
    })

    expect(result.canBook).toBe(false)
    if (!result.canBook) {
      expect(result.reason).toContain('Telehealth')
    }
  })

  it('allows virtual when telehealth is unlocked even if rooms are full', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [createSession({ id: 's1', isVirtual: false, scheduledDay: 1, scheduledHour: 10 })]

    const result = canBookSessionType({
      building,
      sessions,
      telehealthUnlocked: true,
      isVirtual: true,
      day: 1,
      hour: 10,
      durationMinutes: 50,
    })

    expect(result.canBook).toBe(true)
  })

  it('rejects in-office when rooms are full', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [createSession({ id: 's1', isVirtual: false, scheduledDay: 1, scheduledHour: 10 })]

    const result = canBookSessionType({
      building,
      sessions,
      telehealthUnlocked: true,
      isVirtual: false,
      day: 1,
      hour: 10,
      durationMinutes: 50,
    })

    expect(result.canBook).toBe(false)
  })

  it('checks all occupied hours for multi-hour in-office sessions', () => {
    const building = createBuilding({ rooms: 1 })
    const sessions = [createSession({ id: 's1', isVirtual: false, scheduledDay: 1, scheduledHour: 11 })]

    const result = canBookSessionType({
      building,
      sessions,
      telehealthUnlocked: true,
      isVirtual: false,
      day: 1,
      hour: 10,
      durationMinutes: 80,
    })

    expect(result.canBook).toBe(false)
    if (!result.canBook) {
      expect(result.reason).toContain('hour 11')
    }
  })
})
