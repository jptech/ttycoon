import { describe, it, expect } from 'vitest'
import { cloneDeep, deepFreeze } from '../../testUtils/immutability'

import { TimeController } from '@/core/engine'
import { ClientManager } from '@/core/clients'
import { TherapistManager } from '@/core/therapists'
import { InsuranceManager } from '@/core/insurance'
import { OfficeManager } from '@/core/office'
import { EconomyManager } from '@/core/economy'
import { EventManager } from '@/core/events'
import { SessionManager } from '@/core/session'

import { TRAINING_PROGRAMS } from '@/data/trainingPrograms'

import type {
  GameTime,
  Client,
  Therapist,
  ActiveTraining,
  PendingClaim,
  InsurancePanel,
  Session,
  Building,
  EventCooldowns,
} from '@/core/types'

// Minimal fixtures (keep these plain objects so JSON/structuredClone works)
const createClient = (overrides: Partial<Client> = {}): Client => ({
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
})

const createTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: 'therapist-1',
  displayName: 'Dr. Test',
  isPlayer: false,
  energy: 100,
  maxEnergy: 100,
  baseSkill: 50,
  level: 5,
  xp: 0,
  hourlySalary: 60,
  hireDay: 1,
  certifications: [],
  specializations: ['stress_management'],
  status: 'available',
  burnoutRecoveryProgress: 0,
  traits: { warmth: 7, analytical: 5, creativity: 5 },
  ...overrides,
})

const createCompletedInsuranceSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  therapistId: 'therapist-1',
  clientId: 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: true,
  scheduledDay: 1,
  scheduledHour: 10,
  durationMinutes: 50,
  status: 'completed',
  progress: 1,
  quality: 0.8,
  qualityModifiers: [],
  payment: 0,
  energyCost: 15,
  xpGained: 25,
  decisionsMade: [],
  therapistName: 'Dr. Test',
  clientName: 'Client A',
  completedAt: { day: 1, hour: 10, minute: 50 },
  ...overrides,
})

const createScheduledSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-scheduled-1',
  therapistId: 'therapist-1',
  clientId: 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: false,
  scheduledDay: 1,
  scheduledHour: 9,
  durationMinutes: 50,
  status: 'scheduled',
  progress: 0,
  quality: 0.5,
  qualityModifiers: [],
  payment: 150,
  energyCost: 15,
  xpGained: 0,
  decisionsMade: [],
  therapistName: 'Dr. Test',
  clientName: 'Client AB',
  ...overrides,
})

const createPanel = (overrides: Partial<InsurancePanel> = {}): InsurancePanel => ({
  id: 'aetna',
  name: 'Aetna',
  reimbursement: 120,
  delayDays: 21,
  denialRate: 0.08,
  applicationFee: 200,
  minReputation: 30,
  ...overrides,
})

const createClaim = (overrides: Partial<PendingClaim> = {}): PendingClaim => ({
  id: 'claim-1',
  sessionId: 'session-1',
  insurerId: 'aetna',
  amount: 120,
  scheduledPaymentDay: 22,
  status: 'pending',
  ...overrides,
})

const createBuilding = (overrides: Partial<Building> = {}): Building => ({
  id: 'starter_suite',
  name: 'Starter Suite',
  tier: 1,
  rooms: 1,
  monthlyRent: 1000,
  requiredLevel: 1,
  upgradeCost: 0,
  ...overrides,
})

describe('State immutability regression suite', () => {
  it('TimeController.advanceMinutes does not mutate input time', () => {
    const currentTime: GameTime = { day: 1, hour: 9, minute: 50 }
    const original = cloneDeep(currentTime)
    deepFreeze(currentTime)

    expect(() => TimeController.advanceMinutes(currentTime, 15)).not.toThrow()
    expect(currentTime).toEqual(original)
  })

  it('ClientManager.processWaitingList does not mutate input clients', () => {
    const clients: Client[] = [createClient({ arrivalDay: 1, satisfaction: 70, status: 'waiting' })]
    const original = cloneDeep(clients)
    deepFreeze(clients)

    expect(() => ClientManager.processWaitingList(clients, 5)).not.toThrow()
    expect(clients).toEqual(original)
  })

  it('TherapistManager.processTraining does not mutate therapist or training input', () => {
    const program = TRAINING_PROGRAMS.telehealth_training
    const therapist = createTherapist({ certifications: [] })
    const training: ActiveTraining = {
      programId: program.id,
      therapistId: therapist.id,
      startDay: 1,
      hoursCompleted: 0,
      totalHours: program.durationHours,
    }

    const originalTherapist = cloneDeep(therapist)
    const originalTraining = cloneDeep(training)

    deepFreeze(therapist)
    deepFreeze(training)
    deepFreeze(program)

    expect(() => TherapistManager.processTraining(therapist, training, program, 4)).not.toThrow()
    expect(therapist).toEqual(originalTherapist)
    expect(training).toEqual(originalTraining)
  })

  it('InsuranceManager.processDueClaims does not mutate claims input', () => {
    const claims: PendingClaim[] = [createClaim({ scheduledPaymentDay: 1 })]
    const original = cloneDeep(claims)
    deepFreeze(claims)

    expect(() =>
      InsuranceManager.processDueClaims(
        claims,
        5,
        { aetna: 0.0 },
        123
      )
    ).not.toThrow()

    expect(claims).toEqual(original)
  })

  it('OfficeManager.getRoomAvailability does not mutate building or sessions', () => {
    const building = createBuilding({ rooms: 2 })
    const sessions: Session[] = [createCompletedInsuranceSession({ status: 'scheduled', isVirtual: false })]

    const originalBuilding = cloneDeep(building)
    const originalSessions = cloneDeep(sessions)

    deepFreeze(building)
    deepFreeze(sessions)

    expect(() => OfficeManager.getRoomAvailability(building, sessions, 1, 10)).not.toThrow()
    expect(building).toEqual(originalBuilding)
    expect(sessions).toEqual(originalSessions)
  })

  it('InsuranceManager.applyToPanel does not mutate active/pending arrays', () => {
    const panel = createPanel()
    const activePanels = ['cigna'] as const
    const pendingApplications = ['anthem'] as const

    const active = [...activePanels]
    const pending = [...pendingApplications]

    const originalActive = cloneDeep(active)
    const originalPending = cloneDeep(pending)

    deepFreeze(active)
    deepFreeze(pending)

    expect(() => InsuranceManager.applyToPanel(panel, 100, 1000, active, pending, 42)).not.toThrow()

    expect(active).toEqual(originalActive)
    expect(pending).toEqual(originalPending)
  })

  it('SessionManager.startSession does not mutate input session/therapist/client', () => {
    const session = createScheduledSession({ scheduledDay: 1, scheduledHour: 9 })
    const therapist = createTherapist({ status: 'available' })
    const client = createClient({ status: 'waiting' })

    const originalSession = cloneDeep(session)
    const originalTherapist = cloneDeep(therapist)
    const originalClient = cloneDeep(client)

    deepFreeze(session)
    deepFreeze(therapist)
    deepFreeze(client)

    expect(() => SessionManager.startSession(session, therapist, client)).not.toThrow()
    expect(session).toEqual(originalSession)
    expect(therapist).toEqual(originalTherapist)
    expect(client).toEqual(originalClient)
  })

  it('EconomyManager.processSessionPayment does not mutate input session/client', () => {
    const session = createCompletedInsuranceSession({ status: 'completed', durationMinutes: 50 })
    const client = createClient({ isPrivatePay: true, insuranceProvider: null })

    const originalSession = cloneDeep(session)
    const originalClient = cloneDeep(client)

    deepFreeze(session)
    deepFreeze(client)

    expect(() => EconomyManager.processSessionPayment(session, client, null, 0, 10)).not.toThrow()
    expect(session).toEqual(originalSession)
    expect(client).toEqual(originalClient)
  })

  it('EventManager.updateCooldowns does not mutate input cooldowns', () => {
    const cooldowns: EventCooldowns = { some_event: 5 }
    const original = cloneDeep(cooldowns)
    deepFreeze(cooldowns)

    let updated: EventCooldowns | undefined
    expect(() => {
      updated = EventManager.updateCooldowns(cooldowns, 'new_event', 10, 3)
    }).not.toThrow()

    expect(cooldowns).toEqual(original)
    expect(updated).toEqual({ ...original, new_event: 13 })
  })
})
