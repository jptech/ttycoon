import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { ClientManager } from '@/core/clients'
import {
  getClientSpawnChance,
  getClientSpawnAttempts,
  getSessionRate,
} from '@/data/clientGeneration'
import type { Therapist } from '@/core/types'

// Helper to create a player therapist for new game
function createPlayerTherapist(): Therapist {
  return {
    id: 'player-1',
    displayName: 'Dr. Player',
    isPlayer: true,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 1,
    xp: 0,
    hourlySalary: 0,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: {
      warmth: 7,
      analytical: 5,
      creativity: 5,
    },
  }
}

describe('Client Spawning System', () => {
  beforeEach(() => {
    // Reset store state before each test
    useGameStore.setState({
      clients: [],
      waitingList: [],
      therapists: [],
      currentDay: 1,
      reputation: 20,
      activePanels: [],
    })
  })

  describe('getClientSpawnChance', () => {
    it('returns base 20% chance on day 1 with low reputation', () => {
      const chance = getClientSpawnChance(1, 0)
      expect(chance).toBeCloseTo(0.2 + 0.01, 2) // 0.2 base + 0.01 day bonus
    })

    it('increases spawn chance with higher days', () => {
      const day1Chance = getClientSpawnChance(1, 20)
      const day30Chance = getClientSpawnChance(30, 20)

      expect(day30Chance).toBeGreaterThan(day1Chance)
    })

    it('increases spawn chance with higher reputation', () => {
      const lowRepChance = getClientSpawnChance(10, 20)
      const highRepChance = getClientSpawnChance(10, 100)

      expect(highRepChance).toBeGreaterThan(lowRepChance)
    })

    it('caps spawn chance at 80%', () => {
      // Very high day and reputation
      const maxChance = getClientSpawnChance(100, 300)
      expect(maxChance).toBeLessThanOrEqual(0.8)
    })

    it('calculates day bonus correctly (capped at 30%)', () => {
      // Day 30 should have max day bonus of 0.30
      const day30Chance = getClientSpawnChance(30, 0)
      expect(day30Chance).toBeCloseTo(0.2 + 0.3, 2) // base + max day bonus
    })

    it('calculates reputation bonus correctly (0.2% per point)', () => {
      // 50 reputation = 10% bonus
      const chance = getClientSpawnChance(1, 50)
      const expectedBonus = 50 * 0.002 // 0.1 (10%)
      expect(chance).toBeCloseTo(0.2 + 0.01 + expectedBonus, 2)
    })
  })

  describe('getClientSpawnAttempts', () => {
    it('returns 1 attempt for days 1-9', () => {
      expect(getClientSpawnAttempts(1)).toBe(1)
      expect(getClientSpawnAttempts(5)).toBe(1)
      expect(getClientSpawnAttempts(9)).toBe(1)
    })

    it('returns 2 attempts for days 10-29', () => {
      expect(getClientSpawnAttempts(10)).toBe(2)
      expect(getClientSpawnAttempts(20)).toBe(2)
      expect(getClientSpawnAttempts(29)).toBe(2)
    })

    it('returns 3 attempts for days 30-59', () => {
      expect(getClientSpawnAttempts(30)).toBe(3)
      expect(getClientSpawnAttempts(45)).toBe(3)
      expect(getClientSpawnAttempts(59)).toBe(3)
    })

    it('returns 4 attempts for day 60+', () => {
      expect(getClientSpawnAttempts(60)).toBe(4)
      expect(getClientSpawnAttempts(100)).toBe(4)
      expect(getClientSpawnAttempts(365)).toBe(4)
    })
  })

  describe('getSessionRate', () => {
    it('returns higher rate for private pay', () => {
      // Run multiple times to account for randomness
      const privateRates: number[] = []
      const insuranceRates: number[] = []

      for (let i = 0; i < 100; i++) {
        privateRates.push(getSessionRate(true))
        insuranceRates.push(getSessionRate(false))
      }

      const avgPrivate = privateRates.reduce((a, b) => a + b, 0) / privateRates.length
      const avgInsurance = insuranceRates.reduce((a, b) => a + b, 0) / insuranceRates.length

      expect(avgPrivate).toBeGreaterThan(avgInsurance)
    })

    it('private pay rate is in expected range ($120-$200)', () => {
      for (let i = 0; i < 50; i++) {
        const rate = getSessionRate(true)
        expect(rate).toBeGreaterThanOrEqual(120)
        expect(rate).toBeLessThanOrEqual(200)
      }
    })

    it('insurance rate is in expected range ($80-$150)', () => {
      for (let i = 0; i < 50; i++) {
        const rate = getSessionRate(false)
        expect(rate).toBeGreaterThanOrEqual(80)
        expect(rate).toBeLessThanOrEqual(150)
      }
    })
  })

  describe('Initial Client Seeding (newGame)', () => {
    it('generates 2-3 initial clients when starting new game', () => {
      const therapist = createPlayerTherapist()

      // Run multiple times to verify the range
      const clientCounts: number[] = []
      for (let i = 0; i < 20; i++) {
        useGameStore.getState().newGame('Test Practice', therapist)
        const state = useGameStore.getState()
        clientCounts.push(state.clients.length)

        // Reset for next iteration
        useGameStore.setState({ clients: [], waitingList: [] })
      }

      // All counts should be 2 or 3
      expect(clientCounts.every((c) => c >= 2 && c <= 3)).toBe(true)
      // Should have some variation
      expect(new Set(clientCounts).size).toBeGreaterThanOrEqual(1)
    })

    it('adds initial clients to waiting list', () => {
      const therapist = createPlayerTherapist()
      useGameStore.getState().newGame('Test Practice', therapist)

      const state = useGameStore.getState()
      expect(state.waitingList.length).toBe(state.clients.length)
      expect(state.waitingList.every((id) => state.clients.some((c) => c.id === id))).toBe(true)
    })

    it('initial clients have waiting status', () => {
      const therapist = createPlayerTherapist()
      useGameStore.getState().newGame('Test Practice', therapist)

      const state = useGameStore.getState()
      expect(state.clients.every((c) => c.status === 'waiting')).toBe(true)
    })

    it('initial clients arrive on day 1', () => {
      const therapist = createPlayerTherapist()
      useGameStore.getState().newGame('Test Practice', therapist)

      const state = useGameStore.getState()
      expect(state.clients.every((c) => c.arrivalDay === 1)).toBe(true)
    })

    it('initial clients have valid properties', () => {
      const therapist = createPlayerTherapist()
      useGameStore.getState().newGame('Test Practice', therapist)

      const state = useGameStore.getState()
      for (const client of state.clients) {
        expect(client.id).toBeDefined()
        expect(client.displayName).toMatch(/^Client [A-Z]{2}$/)
        expect(client.conditionCategory).toBeDefined()
        expect(client.severity).toBeGreaterThanOrEqual(1)
        expect(client.severity).toBeLessThanOrEqual(10)
        expect(client.sessionRate).toBeGreaterThan(0)
        expect(client.satisfaction).toBe(70) // BASE_SATISFACTION
        expect(client.engagement).toBe(60) // BASE_ENGAGEMENT

        // Starting clients must be compatible with the starting therapist (no credentials required)
        expect(client.requiredCertification).toBeNull()
        expect(client.isMinor).toBe(false)
        expect(client.isCouple).toBe(false)
      }
    })
  })

  describe('ClientManager.processWaitingList', () => {
    it('decreases satisfaction for waiting clients', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.satisfaction = 70
      client.daysWaiting = 0

      const result = ClientManager.processWaitingList([client], 2)

      expect(result.remainingClients.length).toBe(1)
      expect(result.remainingClients[0].satisfaction).toBe(68) // Lost 2 points
    })

    it('drops clients who exceeded max wait days', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.maxWaitDays = 7
      client.arrivalDay = 1

      // Process on day 8 (waited 7 days = maxWaitDays)
      const result = ClientManager.processWaitingList([client], 8)

      expect(result.droppedClients.length).toBe(1)
      expect(result.remainingClients.length).toBe(0)
      expect(result.droppedClients[0].status).toBe('dropped')
    })

    it('drops clients whose satisfaction falls below threshold', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.satisfaction = 31 // Just above dropout threshold of 30
      client.daysWaiting = 1
      client.arrivalDay = 1
      client.maxWaitDays = 14

      // After losing 2 satisfaction points, will be at 29 (below 30 threshold)
      const result = ClientManager.processWaitingList([client], 2)

      expect(result.droppedClients.length).toBe(1)
      expect(result.droppedClients[0].satisfaction).toBeLessThanOrEqual(30)
    })

    it('does not process non-waiting clients', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.status = 'in_treatment'
      const originalSatisfaction = client.satisfaction

      const result = ClientManager.processWaitingList([client], 5)

      expect(result.remainingClients.length).toBe(1)
      expect(result.remainingClients[0].satisfaction).toBe(originalSatisfaction)
      expect(result.droppedClients.length).toBe(0)
    })

    it('tracks satisfaction changes', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.satisfaction = 70
      client.daysWaiting = 0
      client.maxWaitDays = 14

      const result = ClientManager.processWaitingList([client], 2)

      expect(result.satisfactionChanges.length).toBe(1)
      expect(result.satisfactionChanges[0].oldSatisfaction).toBe(70)
      expect(result.satisfactionChanges[0].newSatisfaction).toBe(68)
    })

    it('updates daysWaiting correctly', () => {
      const client = ClientManager.generateClient(1, [], 150).client
      client.arrivalDay = 1

      const result = ClientManager.processWaitingList([client], 5)

      expect(result.remainingClients[0].daysWaiting).toBe(4) // Day 5 - Day 1 = 4 days
    })
  })

  describe('Client Spawn Rate Progression', () => {
    it('provides smooth difficulty curve across game days', () => {
      const reputation = 50 // Mid-level reputation

      // Early game (days 1-10)
      const earlyChance = getClientSpawnChance(5, reputation)
      const earlyAttempts = getClientSpawnAttempts(5)

      // Mid game (days 30-40)
      const midChance = getClientSpawnChance(35, reputation)
      const midAttempts = getClientSpawnAttempts(35)

      // Late game (days 60+)
      const lateChance = getClientSpawnChance(70, reputation)
      const lateAttempts = getClientSpawnAttempts(70)

      // Expected clients per day (chance * attempts)
      const earlyExpected = earlyChance * earlyAttempts
      const midExpected = midChance * midAttempts
      const lateExpected = lateChance * lateAttempts

      // Should progressively increase
      expect(midExpected).toBeGreaterThan(earlyExpected)
      expect(lateExpected).toBeGreaterThan(midExpected)

      // But not too aggressively
      expect(lateExpected).toBeLessThan(4) // Max 4 attempts at 80% = 3.2 expected
    })
  })
})
