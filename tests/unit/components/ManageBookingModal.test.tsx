import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Building, Client, Therapist, Session } from '@/core/types'
import { ManageBookingModal } from '@/components/game/ManageBookingModal'
import { BUILDINGS } from '@/data/buildings'

function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 'therapist-1',
    displayName: 'Dr. One',
    isPlayer: false,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 1,
    xp: 0,
    hourlySalary: 50,
    hireDay: 1,
    certifications: [],
    specializations: [],
    status: 'available',
    burnoutRecoveryProgress: 0,
    traits: { warmth: 5, analytical: 5, creativity: 5 },
    ...overrides,
  }
}

function createClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    displayName: 'Client One',
    conditionCategory: 'anxiety',
    conditionType: 'generalized_anxiety',
    severity: 5,
    sessionsRequired: 8,
    sessionsCompleted: 0,
    treatmentProgress: 0,
    status: 'waiting',
    satisfaction: 50,
    engagement: 75,
    isPrivatePay: true,
    insuranceProvider: null,
    sessionRate: 150,
    prefersVirtual: false,
    preferredFrequency: 'weekly',
    preferredTime: 'any',
    availability: {
      monday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      tuesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      wednesday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      thursday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      friday: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    },
    requiredCertification: null,
    isMinor: false,
    isCouple: false,
    arrivalDay: 1,
    daysWaiting: 0,
    maxWaitDays: 10,
    assignedTherapistId: null,
    ...overrides,
  }
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
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
    quality: 0.5,
    qualityModifiers: [],
    payment: 150,
    energyCost: 15,
    xpGained: 0,
    decisionsMade: [],
    therapistName: 'Dr. One',
    clientName: 'Client One',
    ...overrides,
  }
}

describe('ManageBookingModal', () => {
  it('disables cancel for sessions in the past', () => {
    const onClose = vi.fn()

    render(
      <ManageBookingModal
        open
        onClose={onClose}
        session={createSession({ scheduledDay: 1, scheduledHour: 9 })}
        clients={[createClient()]}
        therapists={[createTherapist()]}
        sessions={[createSession({ scheduledDay: 1, scheduledHour: 9 })]}
        currentBuilding={BUILDINGS.starter_suite as Building}
        telehealthUnlocked={false}
        currentDay={1}
        currentHour={10}
        currentMinute={0}
        onCancel={() => ({ success: true })}
        onReschedule={() => ({ success: true })}
      />
    )

    expect(screen.getByRole('button', { name: 'Cancel Session' })).toBeDisabled()
  })

  it('calls onReschedule with selected slot and options', () => {
    const onClose = vi.fn()
    const onReschedule = vi.fn(() => ({ success: true }))

    render(
      <ManageBookingModal
        open
        onClose={onClose}
        session={createSession({ scheduledDay: 1, scheduledHour: 10 })}
        clients={[createClient()]}
        therapists={[createTherapist()]}
        sessions={[createSession({ scheduledDay: 1, scheduledHour: 10 })]}
        currentBuilding={BUILDINGS.starter_suite as Building}
        telehealthUnlocked={false}
        currentDay={1}
        currentHour={8}
        currentMinute={0}
        onCancel={() => ({ success: true })}
        onReschedule={onReschedule}
      />
    )

    // Pick the first slot offered
    const slotButtons = screen.getAllByRole('button', { name: /Day 1/i })
    fireEvent.click(slotButtons[0])

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }))

    expect(onReschedule).toHaveBeenCalledTimes(1)
    expect(onReschedule.mock.calls[0][0]).toMatchObject({
      sessionId: 'session-1',
      therapistId: 'therapist-1',
      duration: 50,
      isVirtual: false,
    })
  })
})
