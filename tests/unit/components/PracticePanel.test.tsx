import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PracticePanel } from '@/components/game/PracticePanel'
import type { Session, Therapist, Transaction, PendingClaim, InsurerId } from '@/core/types'

const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: overrides.id ?? 'session-1',
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

describe('PracticePanel', () => {
  const defaultProps = {
    balance: 5000,
    pendingClaims: [] as PendingClaim[],
    therapists: [createTherapist()],
    transactions: [] as Transaction[],
    sessions: [createSession()],
    currentBuildingId: 'starter_suite',
    currentDay: 10,
    activePanels: [] as InsurerId[],
    reputation: 100,
    insuranceMultiplier: 1,
    onApplyToPanel: vi.fn(),
    onDropPanel: vi.fn(),
  }

  describe('subtab navigation', () => {
    it('shows Sessions tab first (leftmost)', () => {
      render(<PracticePanel {...defaultProps} />)

      const tabs = screen.getAllByRole('button').filter(btn =>
        ['Sessions', 'Finances', 'Insurance'].some(name => btn.textContent?.includes(name))
      )

      // Sessions should be the first tab
      expect(tabs[0]).toHaveTextContent('Sessions')
    })

    it('defaults to Sessions tab', () => {
      render(<PracticePanel {...defaultProps} />)

      // SessionHistoryPanel should be visible by default
      expect(screen.getByText('Average Quality')).toBeInTheDocument()
    })

    it('switches to Finances tab when clicked', () => {
      render(<PracticePanel {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /Finances/i }))

      // EconomyPanel content should be visible
      expect(screen.getByText('Current Balance')).toBeInTheDocument()
    })

    it('switches to Insurance tab when clicked', () => {
      render(<PracticePanel {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /Insurance/i }))

      // InsurancePanelView content should be visible
      expect(screen.getByText(/Insurance Panels/i)).toBeInTheDocument()
    })

    it('switches back to Sessions tab when clicked', () => {
      render(<PracticePanel {...defaultProps} />)

      // Switch to Finances first
      fireEvent.click(screen.getByRole('button', { name: /Finances/i }))
      expect(screen.getByText('Current Balance')).toBeInTheDocument()

      // Switch back to Sessions
      fireEvent.click(screen.getByRole('button', { name: /Sessions/i }))
      expect(screen.getByText('Average Quality')).toBeInTheDocument()
    })
  })

  describe('session count badge', () => {
    it('shows completed session count on Sessions tab', () => {
      const sessions = [
        createSession({ id: 's-1', status: 'completed' }),
        createSession({ id: 's-2', status: 'completed' }),
        createSession({ id: 's-3', status: 'scheduled' }), // Not completed
      ]

      render(<PracticePanel {...defaultProps} sessions={sessions} />)

      // Should show "2" badge (only completed sessions)
      const sessionsTab = screen.getByRole('button', { name: /Sessions/i })
      expect(sessionsTab).toHaveTextContent('2')
    })

    it('does not show badge when no completed sessions', () => {
      const sessions = [
        createSession({ id: 's-1', status: 'scheduled' }),
      ]

      render(<PracticePanel {...defaultProps} sessions={sessions} />)

      const sessionsTab = screen.getByRole('button', { name: /Sessions/i })
      // Should just say "Sessions" without a number
      expect(sessionsTab.textContent?.trim()).toBe('Sessions')
    })
  })

  describe('pending claims badge', () => {
    it('shows pending claims count on Insurance tab', () => {
      const pendingClaims: PendingClaim[] = [
        { id: 'c1', sessionId: 's1', clientId: 'cl1', panelId: 'aetna', amount: 100, dueDay: 15, submittedDay: 10 },
        { id: 'c2', sessionId: 's2', clientId: 'cl2', panelId: 'aetna', amount: 120, dueDay: 16, submittedDay: 10 },
      ]

      render(<PracticePanel {...defaultProps} pendingClaims={pendingClaims} />)

      const insuranceTab = screen.getByRole('button', { name: /Insurance/i })
      expect(insuranceTab).toHaveTextContent('2')
    })
  })

  describe('active panels badge', () => {
    it('shows active panels count on Insurance tab', () => {
      const activePanels: InsurerId[] = ['aetna', 'bcbs', 'united']

      render(<PracticePanel {...defaultProps} activePanels={activePanels} />)

      const insuranceTab = screen.getByRole('button', { name: /Insurance/i })
      expect(insuranceTab).toHaveTextContent('3 panels')
    })
  })
})
