import { describe, it, expect } from 'vitest'
import {
  ClientManager,
  CLIENT_CONFIG,
  CONDITION_TYPES,
  CERTIFICATION_REQUIREMENTS,
  getCredentialRequirementChance,
} from '@/core/clients'
import type { Client, Therapist } from '@/core/types'

function makeSequenceRandom(values: number[], fallback: number = 0.5): () => number {
  let i = 0
  return () => values[i++] ?? fallback
}

// Helper to create a test client
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
    satisfaction: 70,
    engagement: 60,
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

// Helper to create a test therapist
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
    traits: {
      warmth: 7,
      analytical: 5,
      creativity: 5,
    },
    ...overrides,
  }
}

describe('ClientManager', () => {
  describe('generateClient', () => {
    it('generates a client with valid properties', () => {
      const result = ClientManager.generateClient(1, ['aetna'], 150)
      const client = result.client

      expect(client.id).toBeDefined()
      expect(client.displayName).toMatch(/^Client [A-Z]{2}$/)
      expect(client.conditionCategory).toBeDefined()
      expect(client.conditionType).toBeDefined()
      expect(client.severity).toBeGreaterThanOrEqual(CLIENT_CONFIG.MIN_SEVERITY)
      expect(client.severity).toBeLessThanOrEqual(CLIENT_CONFIG.MAX_SEVERITY)
      expect(client.status).toBe('waiting')
      expect(client.arrivalDay).toBe(1)
    })

    it('generates deterministic clients with seed', () => {
      const result1 = ClientManager.generateClient(1, ['aetna'], 150, 12345)
      const result2 = ClientManager.generateClient(1, ['aetna'], 150, 12345)

      expect(result1.client.displayName).toBe(result2.client.displayName)
      expect(result1.client.conditionCategory).toBe(result2.client.conditionCategory)
      expect(result1.client.severity).toBe(result2.client.severity)
    })

    it('generates private pay clients when no insurers available', () => {
      const result = ClientManager.generateClient(1, [], 150, 42)

      expect(result.client.isPrivatePay).toBe(true)
      expect(result.client.insuranceProvider).toBeNull()
    })

    it('sets sessions required based on severity', () => {
      // Use seed that gives high severity
      const result = ClientManager.generateClient(1, ['aetna'], 150, 999)
      const client = result.client

      expect(client.sessionsRequired).toBeGreaterThanOrEqual(CLIENT_CONFIG.MIN_SESSIONS_REQUIRED)
      expect(client.sessionsRequired).toBeLessThanOrEqual(CLIENT_CONFIG.MAX_SESSIONS_REQUIRED)
    })

    it('sets base satisfaction and engagement', () => {
      const result = ClientManager.generateClient(1, ['aetna'], 150)
      const client = result.client

      expect(client.satisfaction).toBe(CLIENT_CONFIG.BASE_SATISFACTION)
      expect(client.engagement).toBe(CLIENT_CONFIG.BASE_ENGAGEMENT)
    })

    it('returns reason for new client', () => {
      const result = ClientManager.generateClient(1, ['aetna'], 150)

      expect(result.reason).toContain('New client seeking help with')
    })

    it('can force generated clients to have no credential requirements (starting-client safety)', () => {
      const result = ClientManager.generateClient(1, ['aetna'], 150, undefined, {
        forceNoCredentials: true,
        practiceLevel: 5,
        random: makeSequenceRandom([0, 0, 0, 0, 0]),
      })

      expect(result.client.requiredCertification).toBeNull()
      expect(result.client.isMinor).toBe(false)
      expect(result.client.isCouple).toBe(false)
    })

    it('can require a certification at higher progression (progressive credential requirements)', () => {
      const result = ClientManager.generateClient(200, ['aetna'], 150, undefined, {
        practiceLevel: 5,
        // Make "requiresCredentials" roll succeed.
        random: makeSequenceRandom([0.0]),
      })

      expect(result.client.requiredCertification).not.toBeNull()
    })
  })
  
  describe('getUpcomingSessionsSummary', () => {
    it('filters and sorts upcoming scheduled sessions at/after current time', () => {
      const client = createTestClient({ id: 'c1', displayName: 'Client', status: 'in_treatment', sessionsRequired: 6 })

      const sessions = [
        {
          id: 'sPast',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 9,
          duration: 1,
          isVirtual: false,
          roomId: 'r1',
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 'sNow',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 10,
          duration: 1,
          isVirtual: true,
          roomId: null,
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 'sFuture1',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't2',
          therapistName: 'Therapist 2',
          scheduledDay: 2,
          scheduledHour: 11,
          duration: 2,
          isVirtual: false,
          roomId: 'r2',
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 'sFuture2',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't3',
          therapistName: 'Therapist 3',
          scheduledDay: 3,
          scheduledHour: 9,
          duration: 1,
          isVirtual: false,
          roomId: 'r3',
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
      ]

      const summary = ClientManager.getUpcomingSessionsSummary(client, sessions as any, { day: 2, hour: 10, minute: 0 })
      expect(summary.scheduledCount).toBe(3)
      expect(summary.upcomingScheduled.map((s) => s.id)).toEqual(['sNow', 'sFuture1', 'sFuture2'])
    })

    it('excludes current-hour sessions once the hour has started (minute > 0)', () => {
      const client = createTestClient({ id: 'c1', displayName: 'Client', status: 'in_treatment', sessionsRequired: 4 })

      const sessions = [
        {
          id: 'sNow',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 10,
          duration: 1,
          isVirtual: true,
          roomId: null,
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 'sLater',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 11,
          duration: 1,
          isVirtual: true,
          roomId: null,
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
      ]

      const summary = ClientManager.getUpcomingSessionsSummary(client, sessions as any, { day: 2, hour: 10, minute: 5 })
      expect(summary.upcomingScheduled.map((s) => s.id)).toEqual(['sLater'])
    })

    it('counts in-progress sessions separately and clamps unscheduledRemaining to >= 0', () => {
      const client = createTestClient({ id: 'c1', displayName: 'Client', status: 'in_treatment', sessionsRequired: 2 })

      const sessions = [
        {
          id: 's1',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 10,
          duration: 1,
          isVirtual: false,
          roomId: 'r1',
          status: 'in_progress',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 's2',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 11,
          duration: 1,
          isVirtual: false,
          roomId: 'r1',
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
        {
          id: 's3',
          clientId: 'c1',
          clientName: 'Client',
          therapistId: 't1',
          therapistName: 'Therapist',
          scheduledDay: 2,
          scheduledHour: 12,
          duration: 1,
          isVirtual: false,
          roomId: 'r1',
          status: 'scheduled',
          notes: '',
          quality: null,
          decisionEvent: null,
          billing: null,
        },
      ]

      const summary = ClientManager.getUpcomingSessionsSummary(client, sessions as any, { day: 2, hour: 10, minute: 0 })
      expect(summary.inProgressCount).toBe(1)
      expect(summary.scheduledCount).toBe(2)
      expect(summary.unscheduledRemaining).toBe(0)
    })
  })

  describe('getCredentialRequirementChance', () => {
    it('starts at 0 for day 1 / level 1', () => {
      expect(getCredentialRequirementChance(1, 1)).toBe(0)
    })

    it('ramps up with day and practice level (capped at max)', () => {
      const early = getCredentialRequirementChance(2, 1)
      const later = getCredentialRequirementChance(120, 5)

      expect(later).toBeGreaterThan(early)
      expect(later).toBeLessThanOrEqual(CLIENT_CONFIG.MAX_CREDENTIAL_REQUIRED_RATE)
    })
  })

  describe('CONDITION_TYPES', () => {
    it('has all condition categories', () => {
      expect(CONDITION_TYPES.anxiety).toBeDefined()
      expect(CONDITION_TYPES.depression).toBeDefined()
      expect(CONDITION_TYPES.trauma).toBeDefined()
      expect(CONDITION_TYPES.stress).toBeDefined()
      expect(CONDITION_TYPES.relationship).toBeDefined()
      expect(CONDITION_TYPES.behavioral).toBeDefined()
    })

    it('each category has condition types', () => {
      for (const types of Object.values(CONDITION_TYPES)) {
        expect(types.length).toBeGreaterThan(0)
      }
    })
  })

  describe('CERTIFICATION_REQUIREMENTS', () => {
    it('trauma requires trauma_certified', () => {
      expect(CERTIFICATION_REQUIREMENTS.trauma).toBe('trauma_certified')
    })

    it('relationship requires couples_certified', () => {
      expect(CERTIFICATION_REQUIREMENTS.relationship).toBe('couples_certified')
    })
  })

  describe('calculateMatchScore', () => {
    it('returns high score for matching therapist', () => {
      const client = createTestClient({ conditionCategory: 'anxiety' })
      const therapist = createTestTherapist({
        specializations: ['anxiety_disorders'],
        traits: { warmth: 10, analytical: 10, creativity: 5 },
      })

      const score = ClientManager.calculateMatchScore(client, therapist)

      expect(score.score).toBeGreaterThan(50)
      expect(score.breakdown.certificationMatch).toBe(100)
      expect(score.breakdown.specializationMatch).toBeGreaterThan(0)
    })

    it('returns zero certification score if required cert missing', () => {
      const client = createTestClient({
        conditionCategory: 'trauma',
        requiredCertification: 'trauma_certified',
      })
      const therapist = createTestTherapist({ certifications: [] })

      const score = ClientManager.calculateMatchScore(client, therapist)

      expect(score.breakdown.certificationMatch).toBe(0)
    })

    it('returns zero certification score for minor without children cert', () => {
      const client = createTestClient({ isMinor: true })
      const therapist = createTestTherapist({ certifications: [] })

      const score = ClientManager.calculateMatchScore(client, therapist)

      expect(score.breakdown.certificationMatch).toBe(0)
    })

    it('returns high certification score for minor with children cert', () => {
      const client = createTestClient({ isMinor: true })
      const therapist = createTestTherapist({ certifications: ['children_certified'] })

      const score = ClientManager.calculateMatchScore(client, therapist)

      expect(score.breakdown.certificationMatch).toBe(100)
    })

    it('weights warmth in trait matching', () => {
      const client = createTestClient()
      const warmTherapist = createTestTherapist({ traits: { warmth: 10, analytical: 1, creativity: 1 } })
      const coldTherapist = createTestTherapist({ traits: { warmth: 1, analytical: 1, creativity: 1 } })

      const warmScore = ClientManager.calculateMatchScore(client, warmTherapist)
      const coldScore = ClientManager.calculateMatchScore(client, coldTherapist)

      expect(warmScore.breakdown.traitMatch).toBeGreaterThan(coldScore.breakdown.traitMatch)
    })
  })

  describe('findBestMatch', () => {
    it('returns null if no therapists available', () => {
      const client = createTestClient()
      const result = ClientManager.findBestMatch(client, [])

      expect(result).toBeNull()
    })

    it('returns null if no therapist meets certification requirements', () => {
      const client = createTestClient({
        requiredCertification: 'trauma_certified',
      })
      const therapist = createTestTherapist({ certifications: [] })

      const result = ClientManager.findBestMatch(client, [therapist])

      expect(result).toBeNull()
    })

    it('returns best matching therapist', () => {
      const client = createTestClient({ conditionCategory: 'anxiety' })
      const therapist1 = createTestTherapist({
        id: 'therapist-1',
        specializations: [],
      })
      const therapist2 = createTestTherapist({
        id: 'therapist-2',
        specializations: ['anxiety_disorders'],
      })

      const result = ClientManager.findBestMatch(client, [therapist1, therapist2])

      expect(result).not.toBeNull()
      expect(result?.therapistId).toBe('therapist-2')
    })

    it('excludes therapists who are burned out', () => {
      const client = createTestClient()
      const therapist = createTestTherapist({ status: 'burned_out' })

      const result = ClientManager.findBestMatch(client, [therapist])

      expect(result).toBeNull()
    })
  })

  describe('assignClient', () => {
    it('assigns client to therapist', () => {
      const client = createTestClient()
      const result = ClientManager.assignClient(client, 'therapist-1')

      expect(result.assignedTherapistId).toBe('therapist-1')
      expect(result.status).toBe('in_treatment')
    })

    it('preserves days waiting', () => {
      const client = createTestClient({ daysWaiting: 5 })
      const result = ClientManager.assignClient(client, 'therapist-1')

      expect(result.daysWaiting).toBe(5)
    })
  })

  describe('processWaitingList', () => {
    it('decreases satisfaction for waiting clients', () => {
      const client = createTestClient({ satisfaction: 70, arrivalDay: 1 })
      const result = ClientManager.processWaitingList([client], 2)

      expect(result.satisfactionChanges.length).toBe(1)
      expect(result.satisfactionChanges[0].newSatisfaction).toBeLessThan(70)
    })

    it('drops clients who waited too long', () => {
      const client = createTestClient({ arrivalDay: 1, maxWaitDays: 5 })
      const result = ClientManager.processWaitingList([client], 10)

      expect(result.droppedClients.length).toBe(1)
      expect(result.droppedClients[0].status).toBe('dropped')
    })

    it('drops clients with satisfaction below threshold', () => {
      const client = createTestClient({ satisfaction: 32, arrivalDay: 1 })
      const result = ClientManager.processWaitingList([client], 2)

      expect(result.droppedClients.length).toBe(1)
    })

    it('keeps clients in treatment unchanged', () => {
      const client = createTestClient({ status: 'in_treatment' })
      const result = ClientManager.processWaitingList([client], 10)

      expect(result.remainingClients.length).toBe(1)
      expect(result.droppedClients.length).toBe(0)
    })
  })

  describe('processSessionOutcome', () => {
    it('increases progress after session', () => {
      const client = createTestClient({ treatmentProgress: 0, sessionsCompleted: 0 })
      const result = ClientManager.processSessionOutcome(client, 0.8)

      expect(result.updatedClient.treatmentProgress).toBeGreaterThan(0)
      expect(result.updatedClient.sessionsCompleted).toBe(1)
      expect(result.progressMade).toBeGreaterThan(0)
    })

    it('increases satisfaction for high quality session', () => {
      const client = createTestClient({ satisfaction: 70 })
      const result = ClientManager.processSessionOutcome(client, 0.9)

      expect(result.satisfactionChange).toBeGreaterThan(0)
      expect(result.updatedClient.satisfaction).toBeGreaterThan(70)
    })

    it('decreases satisfaction for low quality session', () => {
      const client = createTestClient({ satisfaction: 70 })
      const result = ClientManager.processSessionOutcome(client, 0.2)

      expect(result.satisfactionChange).toBeLessThan(0)
      expect(result.updatedClient.satisfaction).toBeLessThan(70)
    })

    it('completes treatment when sessions finished', () => {
      const client = createTestClient({
        sessionsRequired: 5,
        sessionsCompleted: 4,
      })
      const result = ClientManager.processSessionOutcome(client, 0.7)

      expect(result.treatmentCompleted).toBe(true)
      expect(result.updatedClient.status).toBe('completed')
    })

    it('clamps satisfaction and engagement to 0-100', () => {
      const lowClient = createTestClient({ satisfaction: 5, engagement: 5 })
      const lowResult = ClientManager.processSessionOutcome(lowClient, 0.1)

      expect(lowResult.updatedClient.satisfaction).toBeGreaterThanOrEqual(0)
      expect(lowResult.updatedClient.engagement).toBeGreaterThanOrEqual(0)

      const highClient = createTestClient({ satisfaction: 98, engagement: 98 })
      const highResult = ClientManager.processSessionOutcome(highClient, 1.0)

      expect(highResult.updatedClient.satisfaction).toBeLessThanOrEqual(100)
      expect(highResult.updatedClient.engagement).toBeLessThanOrEqual(100)
    })
  })

  describe('checkDropoutRisk', () => {
    it('returns high risk for very low satisfaction and engagement', () => {
      const client = createTestClient({ satisfaction: 30, engagement: 30 })
      const result = ClientManager.checkDropoutRisk(client)

      expect(result.atRisk).toBe(true)
      expect(result.riskLevel).toBe('high')
    })

    it('returns medium risk for low satisfaction', () => {
      const client = createTestClient({ satisfaction: 45, engagement: 70 })
      const result = ClientManager.checkDropoutRisk(client)

      expect(result.atRisk).toBe(true)
      expect(result.riskLevel).toBe('medium')
    })

    it('returns low risk for slightly below average', () => {
      const client = createTestClient({ satisfaction: 55, engagement: 70 })
      const result = ClientManager.checkDropoutRisk(client)

      expect(result.atRisk).toBe(true)
      expect(result.riskLevel).toBe('low')
    })

    it('returns not at risk for good satisfaction and engagement', () => {
      const client = createTestClient({ satisfaction: 75, engagement: 75 })
      const result = ClientManager.checkDropoutRisk(client)

      expect(result.atRisk).toBe(false)
    })
  })

  describe('processDropout', () => {
    it('sets client status to dropped', () => {
      const client = createTestClient({ status: 'in_treatment' })
      const result = ClientManager.processDropout(client)

      expect(result.status).toBe('dropped')
    })
  })

  describe('getClientsByStatus', () => {
    it('filters clients by status', () => {
      const clients = [
        createTestClient({ id: '1', status: 'waiting' }),
        createTestClient({ id: '2', status: 'in_treatment' }),
        createTestClient({ id: '3', status: 'waiting' }),
        createTestClient({ id: '4', status: 'completed' }),
      ]

      expect(ClientManager.getClientsByStatus(clients, 'waiting').length).toBe(2)
      expect(ClientManager.getClientsByStatus(clients, 'in_treatment').length).toBe(1)
      expect(ClientManager.getClientsByStatus(clients, 'completed').length).toBe(1)
      expect(ClientManager.getClientsByStatus(clients, 'dropped').length).toBe(0)
    })
  })

  describe('getWaitingClientsPrioritized', () => {
    it('prioritizes by days waiting and severity', () => {
      const clients = [
        createTestClient({ id: '1', status: 'waiting', daysWaiting: 1, severity: 5 }),
        createTestClient({ id: '2', status: 'waiting', daysWaiting: 5, severity: 3 }),
        createTestClient({ id: '3', status: 'waiting', daysWaiting: 2, severity: 10 }),
      ]

      const prioritized = ClientManager.getWaitingClientsPrioritized(clients)

      // Client 2: 5*2 + 3 = 13, Client 3: 2*2 + 10 = 14, Client 1: 1*2 + 5 = 7
      expect(prioritized[0].id).toBe('3') // Highest priority
      expect(prioritized[1].id).toBe('2')
      expect(prioritized[2].id).toBe('1') // Lowest priority
    })

    it('excludes non-waiting clients', () => {
      const clients = [
        createTestClient({ id: '1', status: 'waiting' }),
        createTestClient({ id: '2', status: 'in_treatment' }),
      ]

      const prioritized = ClientManager.getWaitingClientsPrioritized(clients)

      expect(prioritized.length).toBe(1)
      expect(prioritized[0].id).toBe('1')
    })
  })

  describe('getTherapistClients', () => {
    it('returns clients assigned to therapist', () => {
      const clients = [
        createTestClient({ id: '1', assignedTherapistId: 'therapist-1', status: 'in_treatment' }),
        createTestClient({ id: '2', assignedTherapistId: 'therapist-2', status: 'in_treatment' }),
        createTestClient({ id: '3', assignedTherapistId: 'therapist-1', status: 'in_treatment' }),
        createTestClient({ id: '4', assignedTherapistId: 'therapist-1', status: 'completed' }),
      ]

      const result = ClientManager.getTherapistClients(clients, 'therapist-1')

      expect(result.length).toBe(2)
      expect(result.every((c) => c.assignedTherapistId === 'therapist-1')).toBe(true)
    })
  })

  describe('getClientStats', () => {
    it('returns correct counts by status', () => {
      const clients = [
        createTestClient({ status: 'waiting' }),
        createTestClient({ status: 'waiting' }),
        createTestClient({ status: 'in_treatment' }),
        createTestClient({ status: 'completed' }),
        createTestClient({ status: 'dropped' }),
      ]

      const stats = ClientManager.getClientStats(clients)

      expect(stats.waiting).toBe(2)
      expect(stats.inTreatment).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.dropped).toBe(1)
    })

    it('calculates average satisfaction for active clients', () => {
      const clients = [
        createTestClient({ status: 'waiting', satisfaction: 60 }),
        createTestClient({ status: 'in_treatment', satisfaction: 80 }),
        createTestClient({ status: 'completed', satisfaction: 90 }),
      ]

      const stats = ClientManager.getClientStats(clients)

      expect(stats.avgSatisfaction).toBe(70) // (60 + 80) / 2
    })

    it('calculates average progress for in-treatment clients', () => {
      const clients = [
        createTestClient({ status: 'in_treatment', treatmentProgress: 0.5 }),
        createTestClient({ status: 'in_treatment', treatmentProgress: 0.3 }),
        createTestClient({ status: 'waiting', treatmentProgress: 0 }),
      ]

      const stats = ClientManager.getClientStats(clients)

      expect(stats.avgProgress).toBe(40) // (50 + 30) / 2
    })
  })

  describe('calculateExpectedRevenue', () => {
    it('calculates revenue from remaining sessions', () => {
      const clients = [
        createTestClient({
          status: 'in_treatment',
          sessionsRequired: 10,
          sessionsCompleted: 3,
          sessionRate: 100,
        }),
        createTestClient({
          status: 'in_treatment',
          sessionsRequired: 5,
          sessionsCompleted: 2,
          sessionRate: 150,
        }),
      ]

      const revenue = ClientManager.calculateExpectedRevenue(clients)

      // Client 1: 7 * 100 = 700, Client 2: 3 * 150 = 450
      expect(revenue).toBe(1150)
    })

    it('excludes non-treatment clients', () => {
      const clients = [
        createTestClient({ status: 'waiting', sessionsRequired: 10, sessionRate: 100 }),
        createTestClient({ status: 'completed', sessionsRequired: 10, sessionRate: 100 }),
      ]

      const revenue = ClientManager.calculateExpectedRevenue(clients)

      expect(revenue).toBe(0)
    })
  })

  describe('getAtRiskClients', () => {
    it('returns clients at risk of dropout', () => {
      const clients = [
        createTestClient({ id: '1', status: 'in_treatment', satisfaction: 80, engagement: 80 }),
        createTestClient({ id: '2', status: 'in_treatment', satisfaction: 40, engagement: 40 }),
        createTestClient({ id: '3', status: 'waiting', satisfaction: 45, engagement: 60 }),
        createTestClient({ id: '4', status: 'completed', satisfaction: 30, engagement: 30 }),
      ]

      const atRisk = ClientManager.getAtRiskClients(clients)

      expect(atRisk.length).toBe(2)
      expect(atRisk.some((c) => c.id === '2')).toBe(true)
      expect(atRisk.some((c) => c.id === '3')).toBe(true)
    })
  })

  describe('formatClientSummary', () => {
    it('formats client summary correctly', () => {
      const client = createTestClient({
        displayName: 'Client XY',
        conditionType: 'Panic Disorder',
        severity: 7,
      })

      const summary = ClientManager.formatClientSummary(client)

      expect(summary).toBe('Client XY - Panic Disorder (Severity: 7/10)')
    })
  })
})
