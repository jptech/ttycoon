import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionHistoryPanel } from '@/components/game/SessionHistoryPanel'
import type { Session, Therapist } from '@/core/types'

let nextSessionId = 1

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: overrides.id ?? `session-${nextSessionId++}`,
  therapistId: overrides.therapistId ?? 'therapist-1',
  clientId: overrides.clientId ?? 'client-1',
  sessionType: 'clinical',
  isVirtual: false,
  isInsurance: false,
  scheduledDay: overrides.scheduledDay ?? 1,
  scheduledHour: overrides.scheduledHour ?? 10,
  durationMinutes: overrides.durationMinutes ?? 50,
  status: overrides.status ?? 'completed',
  progress: overrides.progress ?? 1,
  quality: overrides.quality ?? 0.82,
  qualityModifiers: overrides.qualityModifiers ?? [],
  payment: overrides.payment ?? 150,
  energyCost: overrides.energyCost ?? 10,
  xpGained: overrides.xpGained ?? 0,
  completedAt: overrides.completedAt ?? { day: 2, hour: 11, minute: 0 },
  decisionsMade: overrides.decisionsMade ?? [],
  therapistName: overrides.therapistName ?? 'Dr. Rivera',
  clientName: overrides.clientName ?? 'Client AB',
})

const createTherapist = (overrides: Partial<Therapist> = {}): Therapist => ({
  id: overrides.id ?? 'therapist-1',
  displayName: overrides.displayName ?? 'Dr. Rivera',
  isPlayer: overrides.isPlayer ?? true,
  energy: overrides.energy ?? 90,
  maxEnergy: overrides.maxEnergy ?? 100,
  baseSkill: overrides.baseSkill ?? 70,
  level: overrides.level ?? 3,
  xp: overrides.xp ?? 150,
  hourlySalary: overrides.hourlySalary ?? 0,
  hireDay: overrides.hireDay ?? 1,
  certifications: overrides.certifications ?? [],
  specializations: overrides.specializations ?? [],
  status: overrides.status ?? 'available',
  burnoutRecoveryProgress: overrides.burnoutRecoveryProgress ?? 0,
  traits: overrides.traits ?? { warmth: 6, analytical: 6, creativity: 5 },
})

describe('SessionHistoryPanel', () => {
  let therapists: Therapist[]
  let sessions: Session[]

  beforeEach(() => {
    nextSessionId = 1
    therapists = [
      createTherapist({ id: 'therapist-1', displayName: 'Dr. Rivera', isPlayer: true }),
      createTherapist({ id: 'therapist-2', displayName: 'Dr. Chen', isPlayer: false, hourlySalary: 85 }),
    ]

    sessions = [
      createSession({ id: 's-1', therapistId: 'therapist-1', therapistName: 'Dr. Rivera', clientName: 'Client AB', quality: 0.88, payment: 160, completedAt: { day: 3, hour: 12, minute: 0 } }),
      createSession({ id: 's-2', therapistId: 'therapist-2', therapistName: 'Dr. Chen', clientName: 'Client XY', quality: 0.62, payment: 140, completedAt: { day: 3, hour: 14, minute: 30 } }),
    ]
  })

  describe('rendering', () => {
    it('shows average quality and recent session entries', () => {
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      expect(screen.getByText('Average Quality')).toBeInTheDocument()
      expect(screen.getByText('Client AB')).toBeInTheDocument()
      expect(screen.getByText('Client XY')).toBeInTheDocument()
    })

    it('shows empty state when no completed sessions', () => {
      render(<SessionHistoryPanel sessions={[]} therapists={therapists} currentDay={10} />)

      expect(screen.getByText(/No completed sessions yet/)).toBeInTheDocument()
    })

    it('shows empty state for scheduled but not completed sessions', () => {
      const scheduledSessions = [
        createSession({ status: 'scheduled', completedAt: undefined }),
      ]
      render(<SessionHistoryPanel sessions={scheduledSessions} therapists={therapists} currentDay={10} />)

      expect(screen.getByText(/No completed sessions yet/)).toBeInTheDocument()
    })

    it('displays quality distribution buckets', () => {
      const mixedQualitySessions = [
        createSession({ id: 'q1', quality: 0.95 }), // Excellent
        createSession({ id: 'q2', quality: 0.80 }), // Good
        createSession({ id: 'q3', quality: 0.55 }), // Fair
        createSession({ id: 'q4', quality: 0.30 }), // Poor
        createSession({ id: 'q5', quality: 0.10 }), // Very Poor
      ]
      render(<SessionHistoryPanel sessions={mixedQualitySessions} therapists={therapists} currentDay={10} />)

      // Each bucket label appears multiple times (in bucket header and session badges)
      // Just verify they exist somewhere in the document
      expect(screen.getAllByText('Excellent').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Good').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Fair').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Poor').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Very Poor').length).toBeGreaterThanOrEqual(1)
    })

    it('calculates correct average quality', () => {
      // quality 0.88 + 0.62 = 1.5, avg = 0.75 = 75%
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('displays session count in header', () => {
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      expect(screen.getByText(/Recent Sessions \(2\)/)).toBeInTheDocument()
    })
  })

  describe('therapist filtering', () => {
    it('filters sessions by therapist selection', () => {
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      fireEvent.click(screen.getByRole('button', { name: 'Dr. Chen' }))

      expect(screen.queryByText('Client AB')).not.toBeInTheDocument()
      expect(screen.getByText('Client XY')).toBeInTheDocument()
    })

    it('resets to all therapists when clicking All', () => {
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      // First filter to one therapist
      fireEvent.click(screen.getByRole('button', { name: 'Dr. Chen' }))
      expect(screen.queryByText('Client AB')).not.toBeInTheDocument()

      // Then reset to all
      fireEvent.click(screen.getByRole('button', { name: 'All' }))
      expect(screen.getByText('Client AB')).toBeInTheDocument()
      expect(screen.getByText('Client XY')).toBeInTheDocument()
    })

    it('shows correct filter name in header', () => {
      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

      expect(screen.getByText('Showing All Therapists')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Dr. Rivera' }))
      expect(screen.getByText('Showing Dr. Rivera')).toBeInTheDocument()
    })
  })

  describe('time range filtering', () => {
    it('filters sessions by time range', () => {
      sessions.push(
        createSession({ id: 's-3', therapistId: 'therapist-1', therapistName: 'Dr. Rivera', clientName: 'Client Old', quality: 0.9, completedAt: { day: 1, hour: 9, minute: 0 } })
      )

      render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={35} />)

      expect(screen.getByText('Client Old')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }))

      expect(screen.queryByText('Client Old')).not.toBeInTheDocument()
    })

    it('filters to last 7 days correctly', () => {
      const recentSession = createSession({
        id: 's-recent',
        clientName: 'Recent Client',
        completedAt: { day: 8, hour: 10, minute: 0 },
      })
      const oldSession = createSession({
        id: 's-old',
        clientName: 'Old Client',
        completedAt: { day: 1, hour: 10, minute: 0 },
      })

      render(<SessionHistoryPanel sessions={[recentSession, oldSession]} therapists={therapists} currentDay={10} />)

      // Both visible in All Time (default)
      expect(screen.getByText('Recent Client')).toBeInTheDocument()
      expect(screen.getByText('Old Client')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }))

      // Only recent visible (day 10 - 7 + 1 = day 4, so day 1 session excluded)
      expect(screen.getByText('Recent Client')).toBeInTheDocument()
      expect(screen.queryByText('Old Client')).not.toBeInTheDocument()
    })

    it('recalculates average quality when time range changes', () => {
      const excellentSession = createSession({
        id: 's-excellent',
        quality: 0.92,
        completedAt: { day: 30, hour: 10, minute: 0 },
      })
      const poorSession = createSession({
        id: 's-poor',
        quality: 0.28,
        completedAt: { day: 1, hour: 10, minute: 0 },
      })

      render(<SessionHistoryPanel sessions={[excellentSession, poorSession]} therapists={therapists} currentDay={35} />)

      // All Time: avg = (0.92 + 0.28) / 2 = 0.6 = 60%
      expect(screen.getByText('60%')).toBeInTheDocument()
      // Both sessions visible, avg shows 60%
      expect(screen.getByText(/Calculated across 2 completed sessions/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }))

      // Last 7 days: only excellent session (day 30), avg = 92%
      // Verify only 1 session is now in the range
      expect(screen.getByText(/Calculated across 1 completed sessions/)).toBeInTheDocument()
      // And the 92% value appears (in both avg and session card)
      expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('session limit', () => {
    it('respects limit prop', () => {
      const manySessions = Array.from({ length: 10 }, (_, i) =>
        createSession({ id: `s-${i}`, clientName: `Client ${i}` })
      )

      render(<SessionHistoryPanel sessions={manySessions} therapists={therapists} currentDay={10} limit={3} />)

      // Only 3 sessions should be visible
      expect(screen.getByText(/Recent Sessions \(3\)/)).toBeInTheDocument()
    })
  })
})
