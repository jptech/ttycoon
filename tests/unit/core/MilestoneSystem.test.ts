import { describe, it, expect, beforeEach } from 'vitest'
import { getMilestoneConfig, MILESTONES, type MilestoneId } from '@/core/types'
import { useGameStore } from '@/store'

describe('Milestone System', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameStore.setState({
      achievedMilestones: [],
      sessions: [],
      clients: [],
      therapists: [],
      currentDay: 1,
      reputation: 20,
    })
  })

  describe('getMilestoneConfig', () => {
    it('returns config for valid milestone ID', () => {
      const config = getMilestoneConfig('first_session_completed')
      expect(config).toBeDefined()
      expect(config?.name).toBe('First Session')
      expect(config?.reputationBonus).toBe(5)
    })

    it('returns undefined for invalid milestone ID', () => {
      const config = getMilestoneConfig('invalid_milestone' as MilestoneId)
      expect(config).toBeUndefined()
    })
  })

  describe('MILESTONES constant', () => {
    it('contains 14 milestones', () => {
      expect(MILESTONES).toHaveLength(14)
    })

    it('has correct milestone IDs', () => {
      const ids = MILESTONES.map((m) => m.id)
      expect(ids).toContain('first_session_completed')
      expect(ids).toContain('first_week_completed')
      expect(ids).toContain('first_client_cured')
      expect(ids).toContain('first_employee_hired')
      expect(ids).toContain('sessions_10_completed')
      expect(ids).toContain('sessions_25_completed')
      expect(ids).toContain('sessions_50_completed')
      expect(ids).toContain('sessions_100_completed')
      expect(ids).toContain('clients_5_cured')
      expect(ids).toContain('clients_10_cured')
      expect(ids).toContain('practice_level_2')
      expect(ids).toContain('practice_level_3')
      expect(ids).toContain('practice_level_4')
      expect(ids).toContain('practice_level_5')
    })

    it('has correct reputation bonuses', () => {
      const bonuses: Record<string, number> = {}
      MILESTONES.forEach((m) => {
        bonuses[m.id] = m.reputationBonus
      })

      expect(bonuses['first_session_completed']).toBe(5)
      expect(bonuses['first_week_completed']).toBe(10)
      expect(bonuses['first_client_cured']).toBe(10)
      expect(bonuses['first_employee_hired']).toBe(15)
      expect(bonuses['sessions_10_completed']).toBe(10)
      expect(bonuses['sessions_25_completed']).toBe(15)
      expect(bonuses['sessions_50_completed']).toBe(20)
      expect(bonuses['sessions_100_completed']).toBe(30)
      expect(bonuses['clients_5_cured']).toBe(15)
      expect(bonuses['clients_10_cured']).toBe(25)
      expect(bonuses['practice_level_2']).toBe(10)
      expect(bonuses['practice_level_3']).toBe(15)
      expect(bonuses['practice_level_4']).toBe(20)
      expect(bonuses['practice_level_5']).toBe(30)
    })
  })

  describe('awardMilestone', () => {
    it('awards milestone and adds to achievedMilestones', () => {
      const { awardMilestone } = useGameStore.getState()

      const result = awardMilestone('first_session_completed')

      expect(result).toBe(true)
      expect(useGameStore.getState().achievedMilestones).toContain('first_session_completed')
    })

    it('adds reputation bonus when awarded', () => {
      const initialRep = useGameStore.getState().reputation
      const { awardMilestone } = useGameStore.getState()

      awardMilestone('first_session_completed')

      const newRep = useGameStore.getState().reputation
      expect(newRep).toBe(initialRep + 5) // first_session_completed gives +5
    })

    it('does not award same milestone twice', () => {
      const { awardMilestone } = useGameStore.getState()

      awardMilestone('first_session_completed')
      const repAfterFirst = useGameStore.getState().reputation

      const secondResult = awardMilestone('first_session_completed')

      expect(secondResult).toBe(false)
      expect(useGameStore.getState().reputation).toBe(repAfterFirst)
      expect(
        useGameStore.getState().achievedMilestones.filter((m) => m === 'first_session_completed')
      ).toHaveLength(1)
    })
  })

  describe('checkAndAwardMilestones', () => {
    it('awards first_session_completed after 1 completed session', () => {
      useGameStore.setState({
        sessions: [
          {
            id: 'session-1',
            status: 'completed',
            therapistId: 't1',
            clientId: 'c1',
            scheduledDay: 1,
            scheduledHour: 9,
            durationMinutes: 50,
            isVirtual: false,
            quality: 0.8,
            progress: 1,
            payment: 150,
            energyCost: 10,
            decisionsMade: [],
            qualityModifiers: [],
            therapistName: 'Test',
            clientName: 'Client',
          },
        ],
      })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('first_session_completed')
      expect(useGameStore.getState().achievedMilestones).toContain('first_session_completed')
    })

    it('awards first_week_completed on day 8', () => {
      useGameStore.setState({ currentDay: 8 })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('first_week_completed')
    })

    it('awards first_employee_hired when non-player therapist exists', () => {
      useGameStore.setState({
        therapists: [
          { id: 't1', isPlayer: true } as any,
          { id: 't2', isPlayer: false } as any,
        ],
      })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('first_employee_hired')
    })

    it('awards first_client_cured when client status is completed', () => {
      useGameStore.setState({
        clients: [{ id: 'c1', status: 'completed' } as any],
      })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('first_client_cured')
    })

    it('awards sessions_10_completed after 10 sessions', () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i}`,
        status: 'completed' as const,
        therapistId: 't1',
        clientId: 'c1',
        scheduledDay: 1,
        scheduledHour: 9 + i,
        durationMinutes: 50,
        isVirtual: false,
        quality: 0.8,
        progress: 1,
        payment: 150,
        energyCost: 10,
        decisionsMade: [],
        qualityModifiers: [],
        therapistName: 'Test',
        clientName: 'Client',
      }))

      useGameStore.setState({ sessions })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('first_session_completed')
      expect(awarded).toContain('sessions_10_completed')
    })

    it('does not re-award already achieved milestones', () => {
      useGameStore.setState({
        achievedMilestones: ['first_session_completed'],
        sessions: [{ id: 's1', status: 'completed' } as any],
      })

      const repBefore = useGameStore.getState().reputation
      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).not.toContain('first_session_completed')
      expect(useGameStore.getState().reputation).toBe(repBefore)
    })

    it('awards sessions_50_completed after 50 sessions', () => {
      const sessions = Array.from({ length: 50 }, (_, i) => ({
        id: `session-${i}`,
        status: 'completed' as const,
        therapistId: 't1',
        clientId: 'c1',
        scheduledDay: 1,
        scheduledHour: 9,
        durationMinutes: 50,
        isVirtual: false,
        quality: 0.8,
        progress: 1,
        payment: 150,
        energyCost: 10,
        decisionsMade: [],
        qualityModifiers: [],
        therapistName: 'Test',
        clientName: 'Client',
      }))

      useGameStore.setState({ sessions })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('sessions_50_completed')
    })

    it('awards clients_5_cured after 5 cured clients', () => {
      const clients = Array.from({ length: 5 }, (_, i) => ({
        id: `client-${i}`,
        status: 'completed' as const,
      }))

      useGameStore.setState({ clients: clients as any })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('clients_5_cured')
    })

    it('awards practice_level_2 when practice level is 2', () => {
      useGameStore.setState({ practiceLevel: 2 })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('practice_level_2')
    })

    it('awards multiple practice level milestones when at level 5', () => {
      useGameStore.setState({ practiceLevel: 5 })

      const { checkAndAwardMilestones } = useGameStore.getState()
      const awarded = checkAndAwardMilestones()

      expect(awarded).toContain('practice_level_2')
      expect(awarded).toContain('practice_level_3')
      expect(awarded).toContain('practice_level_4')
      expect(awarded).toContain('practice_level_5')
    })
  })
})
