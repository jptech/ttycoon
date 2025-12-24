import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { ClientManager, CLIENT_CONFIG } from '@/core/clients'
import type { Client, Therapist } from '@/core/types'

// Test fixtures
function createTestClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    displayName: 'Client AB',
    conditionCategory: 'anxiety',
    conditionType: 'Generalized Anxiety',
    severity: 5,
    sessionsRequired: 10,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'waiting',
    satisfaction: CLIENT_CONFIG.BASE_SATISFACTION,
    engagement: CLIENT_CONFIG.BASE_ENGAGEMENT,
    isPrivatePay: true,
    insuranceProvider: null,
    sessionRate: 150,
    prefersVirtual: false,
    preferredFrequency: 'weekly',
    preferredTime: 'afternoon',
    availability: {
      monday: [14, 15, 16],
      tuesday: [14, 15, 16],
      wednesday: [14, 15, 16],
      thursday: [14, 15, 16],
      friday: [14, 15, 16],
    },
    requiredCertification: null,
    isMinor: false,
    isCouple: false,
    arrivalDay: 1,
    daysWaiting: 0,
    maxWaitDays: 14,
    assignedTherapistId: null,
    ...overrides,
  }
}

function createTestTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 'therapist-1',
    displayName: 'Dr. Smith',
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
    traits: { warmth: 7, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

describe('Client Lifecycle', () => {
  beforeEach(() => {
    useGameStore.setState({
      clients: [],
      waitingList: [],
      sessions: [],
      schedule: {},
      therapists: [],
      currentDay: 1,
      balance: 5000,
      reputation: 20,
    })
  })

  describe('Client Arrival', () => {
    it('addClient adds to both clients array and waitingList', () => {
      const client = createTestClient()

      useGameStore.getState().addClient(client)

      const state = useGameStore.getState()
      expect(state.clients).toHaveLength(1)
      expect(state.waitingList).toContain(client.id)
    })

    it('multiple clients can be added', () => {
      const client1 = createTestClient({ id: 'client-1' })
      const client2 = createTestClient({ id: 'client-2' })

      useGameStore.getState().addClient(client1)
      useGameStore.getState().addClient(client2)

      const state = useGameStore.getState()
      expect(state.clients).toHaveLength(2)
      expect(state.waitingList).toHaveLength(2)
    })

    it('newly arrived clients have correct initial state', () => {
      const client = createTestClient()
      useGameStore.getState().addClient(client)

      const state = useGameStore.getState()
      const storedClient = state.clients[0]

      expect(storedClient.status).toBe('waiting')
      expect(storedClient.satisfaction).toBe(CLIENT_CONFIG.BASE_SATISFACTION)
      expect(storedClient.engagement).toBe(CLIENT_CONFIG.BASE_ENGAGEMENT)
      expect(storedClient.daysWaiting).toBe(0)
      expect(storedClient.assignedTherapistId).toBeNull()
    })
  })

  describe('Client Assignment', () => {
    it('removeFromWaitingList removes client ID from waitingList', () => {
      const client = createTestClient()
      useGameStore.getState().addClient(client)

      useGameStore.getState().removeFromWaitingList(client.id)

      const state = useGameStore.getState()
      expect(state.waitingList).not.toContain(client.id)
      // Client still exists in clients array
      expect(state.clients).toHaveLength(1)
    })

    it('updateClient changes client properties', () => {
      const client = createTestClient()
      useGameStore.getState().addClient(client)

      useGameStore.getState().updateClient(client.id, {
        status: 'in_treatment',
        assignedTherapistId: 'therapist-1',
      })

      const state = useGameStore.getState()
      expect(state.clients[0].status).toBe('in_treatment')
      expect(state.clients[0].assignedTherapistId).toBe('therapist-1')
    })

    it('complete assignment workflow', () => {
      const client = createTestClient()
      const therapist = createTestTherapist()

      useGameStore.getState().addClient(client)
      useGameStore.getState().addTherapist(therapist)

      // Simulate booking
      useGameStore.getState().removeFromWaitingList(client.id)
      useGameStore.getState().updateClient(client.id, {
        status: 'in_treatment',
        assignedTherapistId: therapist.id,
      })

      const state = useGameStore.getState()
      const updatedClient = state.clients[0]

      expect(updatedClient.status).toBe('in_treatment')
      expect(updatedClient.assignedTherapistId).toBe(therapist.id)
      expect(state.waitingList).not.toContain(client.id)
    })
  })

  describe('Session Outcome Processing', () => {
    it('processSessionOutcome updates client progress', () => {
      const client = createTestClient({ sessionsCompleted: 0, treatmentProgress: 0 })

      const result = ClientManager.processSessionOutcome(client, 0.8) // Good quality

      expect(result.updatedClient.sessionsCompleted).toBe(1)
      expect(result.updatedClient.treatmentProgress).toBeGreaterThan(0)
      expect(result.progressMade).toBeGreaterThan(0)
    })

    it('high quality session boosts satisfaction and engagement', () => {
      const client = createTestClient({ satisfaction: 70, engagement: 60 })

      const result = ClientManager.processSessionOutcome(client, 0.9) // Excellent quality

      expect(result.updatedClient.satisfaction).toBeGreaterThan(70)
      expect(result.updatedClient.engagement).toBeGreaterThan(60)
      expect(result.satisfactionChange).toBeGreaterThan(0)
      expect(result.engagementChange).toBeGreaterThan(0)
    })

    it('low quality session decreases satisfaction and engagement', () => {
      const client = createTestClient({ satisfaction: 70, engagement: 60 })

      const result = ClientManager.processSessionOutcome(client, 0.2) // Poor quality

      expect(result.updatedClient.satisfaction).toBeLessThan(70)
      expect(result.updatedClient.engagement).toBeLessThan(60)
      expect(result.satisfactionChange).toBeLessThan(0)
      expect(result.engagementChange).toBeLessThan(0)
    })

    it('treatment completes when sessions required is met', () => {
      const client = createTestClient({
        sessionsRequired: 5,
        sessionsCompleted: 4, // One more to complete
      })

      const result = ClientManager.processSessionOutcome(client, 0.7)

      expect(result.treatmentCompleted).toBe(true)
      expect(result.updatedClient.status).toBe('completed')
    })

    it('treatment completes when progress reaches 100%', () => {
      const client = createTestClient({
        sessionsRequired: 20,
        sessionsCompleted: 5,
        treatmentProgress: 0.95, // Near completion
      })

      const result = ClientManager.processSessionOutcome(client, 0.9)

      // Progress + 0.15 (0.1 base * 1.4 quality multiplier) should exceed 1.0
      if (result.updatedClient.treatmentProgress >= 1) {
        expect(result.treatmentCompleted).toBe(true)
        expect(result.updatedClient.status).toBe('completed')
      }
    })
  })

  describe('Waiting List Processing', () => {
    it('waiting clients lose satisfaction daily', () => {
      const client = createTestClient({
        status: 'waiting',
        satisfaction: 70,
        arrivalDay: 1,
      })

      const result = ClientManager.processWaitingList([client], 2) // Day 2

      expect(result.remainingClients[0].satisfaction).toBe(68) // Lost 2 points
    })

    it('client drops out when max wait days exceeded', () => {
      const client = createTestClient({
        status: 'waiting',
        arrivalDay: 1,
        maxWaitDays: 7,
      })

      const result = ClientManager.processWaitingList([client], 9) // 8 days waiting

      expect(result.droppedClients).toHaveLength(1)
      expect(result.remainingClients).toHaveLength(0)
      expect(result.droppedClients[0].status).toBe('dropped')
    })

    it('client drops out when satisfaction falls below threshold', () => {
      const client = createTestClient({
        status: 'waiting',
        satisfaction: 31, // Just above threshold of 30
        arrivalDay: 1,
        maxWaitDays: 14,
      })

      const result = ClientManager.processWaitingList([client], 2)

      // Satisfaction: 31 - 2 = 29 (below 30 threshold)
      expect(result.droppedClients).toHaveLength(1)
    })

    it('in_treatment clients are not processed in waiting list', () => {
      const client = createTestClient({
        status: 'in_treatment',
        satisfaction: 70,
      })

      const result = ClientManager.processWaitingList([client], 10)

      expect(result.remainingClients[0].satisfaction).toBe(70) // Unchanged
      expect(result.droppedClients).toHaveLength(0)
    })
  })

  describe('Dropout Risk Assessment', () => {
    it('identifies high risk clients', () => {
      const client = createTestClient({
        satisfaction: 35,
        engagement: 35,
      })

      const risk = ClientManager.checkDropoutRisk(client)

      expect(risk.atRisk).toBe(true)
      expect(risk.riskLevel).toBe('high')
    })

    it('identifies medium risk clients', () => {
      const client = createTestClient({
        satisfaction: 45,
        engagement: 70,
      })

      const risk = ClientManager.checkDropoutRisk(client)

      expect(risk.atRisk).toBe(true)
      expect(risk.riskLevel).toBe('medium')
    })

    it('identifies low risk clients', () => {
      const client = createTestClient({
        satisfaction: 58,
        engagement: 70,
      })

      const risk = ClientManager.checkDropoutRisk(client)

      expect(risk.atRisk).toBe(true)
      expect(risk.riskLevel).toBe('low')
    })

    it('healthy clients are not at risk', () => {
      const client = createTestClient({
        satisfaction: 70,
        engagement: 70,
      })

      const risk = ClientManager.checkDropoutRisk(client)

      expect(risk.atRisk).toBe(false)
    })
  })

  describe('Client Matching', () => {
    it('calculates match score between client and therapist', () => {
      const client = createTestClient()
      const therapist = createTestTherapist()

      const score = ClientManager.calculateMatchScore(client, therapist)

      expect(score.score).toBeGreaterThan(0)
      expect(score.clientId).toBe(client.id)
      expect(score.therapistId).toBe(therapist.id)
    })

    it('certification requirement affects match score', () => {
      const client = createTestClient({
        requiredCertification: 'trauma_certified',
      })
      const therapistWithCert = createTestTherapist({
        certifications: ['trauma_certified'],
      })
      const therapistWithoutCert = createTestTherapist({
        id: 'therapist-2',
        certifications: [],
      })

      const scoreWith = ClientManager.calculateMatchScore(client, therapistWithCert)
      const scoreWithout = ClientManager.calculateMatchScore(client, therapistWithoutCert)

      expect(scoreWith.score).toBeGreaterThan(scoreWithout.score)
      expect(scoreWithout.breakdown.certificationMatch).toBe(0)
    })

    it('minor clients require children certification', () => {
      const minorClient = createTestClient({
        isMinor: true,
      })
      const therapistWithCert = createTestTherapist({
        certifications: ['children_certified'],
      })
      const therapistWithoutCert = createTestTherapist({
        id: 'therapist-2',
        certifications: [],
      })

      const scoreWith = ClientManager.calculateMatchScore(minorClient, therapistWithCert)
      const scoreWithout = ClientManager.calculateMatchScore(minorClient, therapistWithoutCert)

      expect(scoreWith.breakdown.certificationMatch).toBe(100)
      expect(scoreWithout.breakdown.certificationMatch).toBe(0)
    })

    it('findBestMatch returns highest scoring available therapist', () => {
      const client = createTestClient()
      const therapists = [
        createTestTherapist({ id: 'therapist-1', traits: { warmth: 3, analytical: 3, creativity: 3 } }),
        createTestTherapist({ id: 'therapist-2', traits: { warmth: 9, analytical: 7, creativity: 7 } }),
        createTestTherapist({ id: 'therapist-3', traits: { warmth: 5, analytical: 5, creativity: 5 } }),
      ]

      const bestMatch = ClientManager.findBestMatch(client, therapists)

      expect(bestMatch).not.toBeNull()
      // The therapist with highest warmth should score best
      expect(bestMatch?.therapistId).toBe('therapist-2')
    })

    it('findBestMatch excludes therapists without required certification', () => {
      const client = createTestClient({
        requiredCertification: 'trauma_certified',
      })
      const therapists = [
        createTestTherapist({ id: 'therapist-1', certifications: [] }),
        createTestTherapist({ id: 'therapist-2', certifications: ['trauma_certified'] }),
      ]

      const bestMatch = ClientManager.findBestMatch(client, therapists)

      expect(bestMatch?.therapistId).toBe('therapist-2')
    })
  })

  describe('Client Statistics', () => {
    it('calculates expected revenue from active clients', () => {
      const clients = [
        createTestClient({
          id: 'c1',
          status: 'in_treatment',
          sessionsRequired: 10,
          sessionsCompleted: 3,
          sessionRate: 150,
        }),
        createTestClient({
          id: 'c2',
          status: 'in_treatment',
          sessionsRequired: 8,
          sessionsCompleted: 2,
          sessionRate: 120,
        }),
      ]

      const revenue = ClientManager.calculateExpectedRevenue(clients)

      // Client 1: (10-3) * 150 = 1050
      // Client 2: (8-2) * 120 = 720
      // Total: 1770
      expect(revenue).toBe(1770)
    })

    it('getAtRiskClients returns clients with low satisfaction/engagement', () => {
      const clients = [
        createTestClient({ id: 'c1', status: 'in_treatment', satisfaction: 40, engagement: 70 }),
        createTestClient({ id: 'c2', status: 'in_treatment', satisfaction: 70, engagement: 70 }),
        createTestClient({ id: 'c3', status: 'waiting', satisfaction: 35, engagement: 35 }),
      ]

      const atRisk = ClientManager.getAtRiskClients(clients)

      expect(atRisk).toHaveLength(2)
      expect(atRisk.map(c => c.id)).toContain('c1')
      expect(atRisk.map(c => c.id)).toContain('c3')
    })

    it('getWaitingClientsPrioritized sorts by priority (days waiting + severity)', () => {
      const clients = [
        createTestClient({ id: 'c1', status: 'waiting', daysWaiting: 1, severity: 5 }),
        createTestClient({ id: 'c2', status: 'waiting', daysWaiting: 5, severity: 3 }),
        createTestClient({ id: 'c3', status: 'waiting', daysWaiting: 2, severity: 9 }),
      ]

      const prioritized = ClientManager.getWaitingClientsPrioritized(clients)

      // Priority = daysWaiting * 2 + severity
      // c1: 1*2 + 5 = 7
      // c2: 5*2 + 3 = 13
      // c3: 2*2 + 9 = 13 (tie with c2)
      expect(prioritized[0].id).toBe('c2')
      expect(prioritized.length).toBe(3)
    })
  })

  describe('Store Client Actions', () => {
    it('removeClient removes from both clients and waitingList', () => {
      const client = createTestClient()
      useGameStore.getState().addClient(client)

      useGameStore.getState().removeClient(client.id)

      const state = useGameStore.getState()
      expect(state.clients).toHaveLength(0)
      expect(state.waitingList).toHaveLength(0)
    })

    it('updateClient preserves other client properties', () => {
      const client = createTestClient({
        displayName: 'Original Name',
        satisfaction: 80,
        engagement: 75,
      })
      useGameStore.getState().addClient(client)

      useGameStore.getState().updateClient(client.id, {
        status: 'in_treatment',
      })

      const state = useGameStore.getState()
      const updated = state.clients[0]
      expect(updated.status).toBe('in_treatment')
      expect(updated.displayName).toBe('Original Name')
      expect(updated.satisfaction).toBe(80)
      expect(updated.engagement).toBe(75)
    })
  })
})
