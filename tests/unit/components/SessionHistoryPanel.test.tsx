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

describe('SessionHistoryPanel', () => {
  let therapists: Therapist[]
  let sessions: Session[]

  beforeEach(() => {
    therapists = [
      {
        id: 'therapist-1',
        displayName: 'Dr. Rivera',
        isPlayer: true,
        energy: 90,
        maxEnergy: 100,
        baseSkill: 70,
        level: 3,
        xp: 150,
        hourlySalary: 0,
        hireDay: 1,
        certifications: [],
        specializations: [],
        status: 'available',
        burnoutRecoveryProgress: 0,
        traits: { warmth: 6, analytical: 6, creativity: 5 },
      },
      {
        id: 'therapist-2',
        displayName: 'Dr. Chen',
        isPlayer: false,
        energy: 80,
        maxEnergy: 100,
        baseSkill: 65,
        level: 2,
        xp: 110,
        hourlySalary: 85,
        hireDay: 4,
        certifications: [],
        specializations: [],
        status: 'available',
        burnoutRecoveryProgress: 0,
        traits: { warmth: 5, analytical: 7, creativity: 4 },
      },
    ]

    sessions = [
      createSession({ id: 's-1', therapistId: 'therapist-1', therapistName: 'Dr. Rivera', clientName: 'Client AB', quality: 0.88, payment: 160, completedAt: { day: 3, hour: 12, minute: 0 } }),
      createSession({ id: 's-2', therapistId: 'therapist-2', therapistName: 'Dr. Chen', clientName: 'Client XY', quality: 0.62, payment: 140, completedAt: { day: 3, hour: 14, minute: 30 } }),
    ]
  })

  it('shows average quality and recent session entries', () => {
    render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

    expect(screen.getByText('Average Quality')).toBeInTheDocument()
    expect(screen.getByText('Client AB')).toBeInTheDocument()
    expect(screen.getByText('Client XY')).toBeInTheDocument()
  })

  it('filters sessions by therapist selection', () => {
    render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={10} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dr. Chen' }))

    expect(screen.queryByText('Client AB')).not.toBeInTheDocument()
    expect(screen.getByText('Client XY')).toBeInTheDocument()
  })

  it('filters sessions by time range', () => {
    sessions.push(
      createSession({ id: 's-3', therapistId: 'therapist-1', therapistName: 'Dr. Rivera', clientName: 'Client Old', quality: 0.9, completedAt: { day: 1, hour: 9, minute: 0 } })
    )

    render(<SessionHistoryPanel sessions={sessions} therapists={therapists} currentDay={35} />)

    expect(screen.getByText('Client Old')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }))

    expect(screen.queryByText('Client Old')).not.toBeInTheDocument()
  })
})
