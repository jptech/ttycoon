import { describe, it, expect, beforeEach } from 'vitest'
import { generateBookingSuggestions, ScheduleManager } from '@/core/schedule'
import type { Building, Client, Schedule, Session, Therapist, GameTime } from '@/core/types'

const building: Building = {
  id: 'b1',
  name: 'Test Building',
  tier: 1,
  rooms: 3,
  monthlyRent: 0,
  upgradeCost: 0,
  requiredLevel: 1,
}

const createTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: 't1',
  displayName: 'Dr. Test',
  isPlayer: true,
  credential: 'LCSW',
  primaryModality: 'CBT',
  secondaryModalities: [],
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
  traits: { warmth: 5, analytical: 5, creativity: 5 },
  ...overrides,
})

const createClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'c1',
  displayName: 'Test Client',
  conditionCategory: 'anxiety',
  conditionType: 'Generalized Anxiety',
  severity: 5,
  sessionsRequired: 10,
  sessionsCompleted: 2,
  treatmentProgress: 0.2,
  status: 'in_treatment',
  satisfaction: 70,
  engagement: 70,
  isPrivatePay: true,
  insuranceProvider: null,
  sessionRate: 150,
  prefersVirtual: false,
  preferredFrequency: 'weekly',
  preferredTime: 'any',
  availability: {
    monday: [8, 9, 10, 11, 14, 15, 16],
    tuesday: [8, 9, 10, 11, 14, 15, 16],
    wednesday: [8, 9, 10, 11, 14, 15, 16],
    thursday: [8, 9, 10, 11, 14, 15, 16],
    friday: [8, 9, 10, 11, 14, 15, 16],
  },
  requiredCertification: null,
  isMinor: false,
  isCouple: false,
  arrivalDay: 1,
  daysWaiting: 0,
  maxWaitDays: 14,
  assignedTherapistId: 't1',
  ...overrides,
})

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  therapistId: 't1',
  clientId: 'c1',
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
  clientName: 'Test Client',
  ...overrides,
})

describe('generateBookingSuggestions', () => {
  let therapists: Therapist[]
  let clients: Client[]
  let sessions: Session[]
  let schedule: Schedule
  let currentTime: GameTime

  beforeEach(() => {
    therapists = [createTherapist()]
    clients = []
    sessions = []
    schedule = {}
    currentTime = { day: 10, hour: 8, minute: 0 }
  })

  describe('basic functionality', () => {
    it('returns empty suggestions when no clients need booking', () => {
      const result = generateBookingSuggestions({
        clients: [],
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(0)
      expect(result.unschedulableClients).toHaveLength(0)
    })

    it('generates suggestion for client with completed session needing follow-up', () => {
      // Client had session on day 1, now day 10 - overdue for weekly follow-up
      const client = createClient({ id: 'c1', preferredFrequency: 'weekly' })
      clients = [client]

      // Completed session on day 1
      const completedSession = createSession({
        id: 's-complete',
        clientId: 'c1',
        therapistId: 't1',
        scheduledDay: 1,
        scheduledHour: 9,
        status: 'completed',
        completedAt: { day: 1, hour: 10, minute: 0 },
      })
      sessions = [completedSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].clientId).toBe('c1')
      expect(result.suggestions[0].therapistId).toBe('t1')
      expect(result.suggestions[0].urgency).toBe('overdue')
    })

    it('generates suggestion for waiting client needing first session', () => {
      const waitingClient = createClient({
        id: 'c-waiting',
        status: 'waiting',
        sessionsCompleted: 0,
        assignedTherapistId: null,
      })
      clients = [waitingClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].clientId).toBe('c-waiting')
    })

    it('does not suggest booking for client with upcoming session', () => {
      const client = createClient()
      clients = [client]

      // Already has scheduled session
      const upcomingSession = createSession({
        id: 's-upcoming',
        clientId: 'c1',
        scheduledDay: 12,
        scheduledHour: 10,
        status: 'scheduled',
      })
      sessions = [upcomingSession]
      schedule = ScheduleManager.buildScheduleFromSessions(sessions)

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(0)
    })

    it('does not suggest booking for client with no remaining sessions', () => {
      const completedClient = createClient({
        id: 'c-done',
        sessionsCompleted: 10,
        sessionsRequired: 10,
      })
      clients = [completedClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(0)
    })
  })

  describe('urgency classification', () => {
    it('marks overdue clients as overdue urgency', () => {
      const client = createClient({ preferredFrequency: 'weekly' })
      clients = [client]

      // Last session was 14 days ago (7+ days overdue for weekly)
      const oldSession = createSession({
        status: 'completed',
        scheduledDay: currentTime.day - 14,
        completedAt: { day: currentTime.day - 14, hour: 10, minute: 0 },
      })
      sessions = [oldSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].urgency).toBe('overdue')
      expect(result.suggestions[0].reason).toBe('overdue_followup')
    })

    it('marks clients due within 3 days as due_soon', () => {
      const client = createClient({ preferredFrequency: 'weekly' })
      clients = [client]

      // Last session was 5 days ago (due in 2 days for weekly)
      const recentSession = createSession({
        status: 'completed',
        scheduledDay: currentTime.day - 5,
        completedAt: { day: currentTime.day - 5, hour: 10, minute: 0 },
      })
      sessions = [recentSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].urgency).toBe('due_soon')
      expect(result.suggestions[0].reason).toBe('due_soon')
    })

    it('marks clients not due soon as normal urgency', () => {
      const client = createClient({ preferredFrequency: 'weekly' })
      clients = [client]

      // Last session was 2 days ago (due in 5 days for weekly)
      const veryRecentSession = createSession({
        status: 'completed',
        scheduledDay: currentTime.day - 2,
        completedAt: { day: currentTime.day - 2, hour: 10, minute: 0 },
      })
      sessions = [veryRecentSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].urgency).toBe('normal')
    })
  })

  describe('therapist selection', () => {
    it('prefers assigned therapist over others', () => {
      const therapist1 = createTherapist({ id: 't1', displayName: 'Dr. One' })
      const therapist2 = createTherapist({ id: 't2', displayName: 'Dr. Two' })
      therapists = [therapist1, therapist2]

      const client = createClient({
        assignedTherapistId: 't2',
        preferredFrequency: 'weekly',
      })
      clients = [client]

      const oldSession = createSession({
        therapistId: 't2',
        status: 'completed',
        scheduledDay: 1,
        completedAt: { day: 1, hour: 10, minute: 0 },
      })
      sessions = [oldSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].therapistId).toBe('t2')
    })

    it('excludes therapists without required certification', () => {
      const uncertifiedTherapist = createTherapist({ id: 't1', certifications: [] })
      const certifiedTherapist = createTherapist({
        id: 't2',
        certifications: ['trauma_certified'],
      })
      therapists = [uncertifiedTherapist, certifiedTherapist]

      const traumaClient = createClient({
        id: 'c-trauma',
        conditionCategory: 'trauma',
        requiredCertification: 'trauma_certified',
        assignedTherapistId: null,
        status: 'waiting',
        sessionsCompleted: 0,
      })
      clients = [traumaClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].therapistId).toBe('t2')
    })

    it('reports unschedulable when no therapist has required certification', () => {
      const uncertifiedTherapist = createTherapist({ id: 't1', certifications: [] })
      therapists = [uncertifiedTherapist]

      const traumaClient = createClient({
        id: 'c-trauma',
        conditionCategory: 'trauma',
        requiredCertification: 'trauma_certified',
        assignedTherapistId: null,
        status: 'waiting',
        sessionsCompleted: 0,
      })
      clients = [traumaClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(0)
      expect(result.unschedulableClients).toHaveLength(1)
      expect(result.unschedulableClients[0].clientId).toBe('c-trauma')
    })
  })

  describe('slot selection', () => {
    it('finds available slot on future day', () => {
      const client = createClient({ status: 'waiting', sessionsCompleted: 0 })
      clients = [client]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].suggestedDay).toBeGreaterThanOrEqual(currentTime.day)
    })

    it('respects room capacity for in-person sessions', () => {
      const smallBuilding: Building = { ...building, rooms: 1 }

      // Room is fully occupied at hour 9 on day 10
      const occupyingSession = createSession({
        id: 's-occupy',
        therapistId: 't2',
        clientId: 'c-other',
        scheduledDay: 10,
        scheduledHour: 9,
        isVirtual: false,
      })
      sessions = [occupyingSession]
      schedule = ScheduleManager.buildScheduleFromSessions(sessions)

      const client = createClient({
        status: 'waiting',
        sessionsCompleted: 0,
        prefersVirtual: false,
      })
      clients = [client]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building: smallBuilding,
        telehealthUnlocked: false,
        currentTime,
      })

      // Should still find a slot, just not at hour 9 on day 10
      expect(result.suggestions).toHaveLength(1)
      const suggestion = result.suggestions[0]
      if (suggestion.suggestedDay === 10) {
        expect(suggestion.suggestedHour).not.toBe(9)
      }
    })

    it('allows virtual sessions when telehealth is unlocked', () => {
      const virtualClient = createClient({
        status: 'waiting',
        sessionsCompleted: 0,
        prefersVirtual: true,
      })
      clients = [virtualClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].isVirtual).toBe(true)
    })

    it('falls back to in-person when telehealth not unlocked', () => {
      const virtualClient = createClient({
        status: 'waiting',
        sessionsCompleted: 0,
        prefersVirtual: true,
      })
      clients = [virtualClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: false,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].isVirtual).toBe(false)
    })
  })

  describe('scoring and sorting', () => {
    it('prioritizes overdue clients over due_soon', () => {
      const overdueClient = createClient({
        id: 'c-overdue',
        preferredFrequency: 'weekly',
      })
      const dueSoonClient = createClient({
        id: 'c-due-soon',
        preferredFrequency: 'weekly',
      })
      clients = [dueSoonClient, overdueClient]

      // Overdue: last session 14 days ago
      const overdueSession = createSession({
        id: 's-overdue',
        clientId: 'c-overdue',
        status: 'completed',
        scheduledDay: currentTime.day - 14,
        completedAt: { day: currentTime.day - 14, hour: 10, minute: 0 },
      })

      // Due soon: last session 5 days ago
      const dueSoonSession = createSession({
        id: 's-due-soon',
        clientId: 'c-due-soon',
        status: 'completed',
        scheduledDay: currentTime.day - 5,
        completedAt: { day: currentTime.day - 5, hour: 10, minute: 0 },
      })

      sessions = [overdueSession, dueSoonSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions).toHaveLength(2)
      expect(result.suggestions[0].clientId).toBe('c-overdue')
      expect(result.suggestions[1].clientId).toBe('c-due-soon')
    })

    it('prioritizes due_soon clients over normal', () => {
      const normalClient = createClient({
        id: 'c-normal',
        preferredFrequency: 'weekly',
      })
      const dueSoonClient = createClient({
        id: 'c-due-soon',
        preferredFrequency: 'weekly',
      })
      clients = [normalClient, dueSoonClient]

      // Normal: last session 2 days ago (due in 5 days)
      const normalSession = createSession({
        id: 's-normal',
        clientId: 'c-normal',
        status: 'completed',
        scheduledDay: currentTime.day - 2,
        completedAt: { day: currentTime.day - 2, hour: 10, minute: 0 },
      })

      // Due soon: last session 6 days ago (due in 1 day)
      const dueSoonSession = createSession({
        id: 's-due-soon',
        clientId: 'c-due-soon',
        status: 'completed',
        scheduledDay: currentTime.day - 6,
        completedAt: { day: currentTime.day - 6, hour: 10, minute: 0 },
      })

      sessions = [normalSession, dueSoonSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions.length).toBeGreaterThanOrEqual(1)
      expect(result.suggestions[0].clientId).toBe('c-due-soon')
    })
  })

  describe('limits and options', () => {
    it('respects maxSuggestions limit', () => {
      // Create 15 waiting clients
      clients = Array.from({ length: 15 }, (_, i) =>
        createClient({
          id: `c-${i}`,
          status: 'waiting',
          sessionsCompleted: 0,
          assignedTherapistId: null,
        })
      )

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
        maxSuggestions: 5,
      })

      expect(result.suggestions.length).toBeLessThanOrEqual(5)
    })

    it('includes follow-up info in suggestions', () => {
      const client = createClient({
        preferredFrequency: 'weekly',
        sessionsRequired: 10,
        sessionsCompleted: 3,
      })
      clients = [client]

      const completedSession = createSession({
        status: 'completed',
        scheduledDay: currentTime.day - 10,
        completedAt: { day: currentTime.day - 10, hour: 10, minute: 0 },
      })
      sessions = [completedSession]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].followUpInfo).toBeDefined()
      expect(result.suggestions[0].followUpInfo.remainingSessions).toBe(7)
      expect(result.suggestions[0].followUpInfo.isOverdue).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles clients with once frequency (no follow-up needed)', () => {
      const onceClient = createClient({
        preferredFrequency: 'once',
        sessionsRequired: 1,
        sessionsCompleted: 0,
        status: 'waiting',
      })
      clients = [onceClient]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      // Should still suggest for waiting clients needing first session
      expect(result.suggestions).toHaveLength(1)
    })

    it('generates unique IDs for each suggestion', () => {
      clients = [
        createClient({ id: 'c1', status: 'waiting', sessionsCompleted: 0 }),
        createClient({ id: 'c2', status: 'waiting', sessionsCompleted: 0 }),
      ]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      const ids = result.suggestions.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('sets duration to 50 minutes', () => {
      const client = createClient({ status: 'waiting', sessionsCompleted: 0 })
      clients = [client]

      const result = generateBookingSuggestions({
        clients,
        therapists,
        sessions,
        schedule,
        building,
        telehealthUnlocked: true,
        currentTime,
      })

      expect(result.suggestions[0].duration).toBe(50)
    })
  })
})
