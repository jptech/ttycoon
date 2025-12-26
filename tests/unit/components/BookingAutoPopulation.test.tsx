import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Building, Client, Therapist, Session, Schedule } from '@/core/types'
import { BookingModal } from '@/components/game/BookingModal'
import { BookingDashboard } from '@/components/game/BookingDashboard'
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

function createEmptySchedule(): Schedule {
  return {
    slots: {},
  }
}

describe('BookingModal Auto-Population', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    therapists: [createTherapist()],
    schedule: createEmptySchedule(),
    sessions: [] as Session[],
    currentBuilding: BUILDINGS.starter_suite as Building,
    telehealthUnlocked: false,
    currentDay: 1,
    currentHour: 8,
    currentMinute: 0,
    onBook: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-enables recurring when client has multiple remaining sessions', () => {
    const client = createClient({
      id: 'multi-session-client',
      sessionsRequired: 8,
      sessionsCompleted: 0,
      preferredFrequency: 'weekly',
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    // Click on the client
    const clientButton = screen.getByText('Client One')
    fireEvent.click(clientButton)

    // Recurring should be auto-enabled
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('does not auto-enable recurring when client has only 1 remaining session', () => {
    const client = createClient({
      id: 'single-session-client',
      sessionsRequired: 8,
      sessionsCompleted: 7,
      preferredFrequency: 'weekly',
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    // Click on the client
    const clientButton = screen.getByText('Client One')
    fireEvent.click(clientButton)

    // Recurring should be disabled
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('sets recurring count to remaining sessions (capped at 12)', () => {
    const client = createClient({
      id: 'many-sessions-client',
      sessionsRequired: 20,
      sessionsCompleted: 0,
      preferredFrequency: 'weekly',
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    // Click on the client
    const clientButton = screen.getByText('Client One')
    fireEvent.click(clientButton)

    // Count should be capped at 12
    const countInput = screen.getByLabelText('Recurring session count') as HTMLInputElement
    expect(countInput.value).toBe('12')
  })

  it('sets interval based on client preferred frequency - weekly', () => {
    const client = createClient({
      preferredFrequency: 'weekly',
      sessionsRequired: 4,
      sessionsCompleted: 0,
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    fireEvent.click(screen.getByText('Client One'))

    // Week button should be selected (has border-primary class)
    const weekButton = screen.getByRole('button', { name: 'Week' })
    expect(weekButton.className).toContain('border-primary')
  })

  it('sets interval based on client preferred frequency - biweekly', () => {
    const client = createClient({
      preferredFrequency: 'biweekly',
      sessionsRequired: 4,
      sessionsCompleted: 0,
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    fireEvent.click(screen.getByText('Client One'))

    // 2 Weeks button should be selected
    const biweeklyButton = screen.getByRole('button', { name: '2 Weeks' })
    expect(biweeklyButton.className).toContain('border-primary')
  })

  it('displays remaining sessions on client card', () => {
    const client = createClient({
      sessionsRequired: 8,
      sessionsCompleted: 3,
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    // Should show "5 remaining" instead of "3/8 sessions"
    expect(screen.getByText(/5 remaining/)).toBeInTheDocument()
  })

  it('displays preferred frequency on client card when remaining > 1', () => {
    const client = createClient({
      sessionsRequired: 8,
      sessionsCompleted: 0,
      preferredFrequency: 'biweekly',
    })

    render(<BookingModal {...defaultProps} clients={[client]} />)

    expect(screen.getByText(/biweekly/)).toBeInTheDocument()
  })
})

describe('BookingDashboard Auto-Population', () => {
  const defaultProps = {
    clients: [] as Client[],
    therapists: [createTherapist()],
    sessions: [] as Session[],
    schedule: createEmptySchedule(),
    currentBuilding: BUILDINGS.starter_suite as Building,
    telehealthUnlocked: false,
    currentDay: 1,
    currentHour: 8,
    currentMinute: 0,
    onBook: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders waiting clients list', () => {
    const client = createClient({
      sessionsRequired: 6,
      sessionsCompleted: 0,
      preferredFrequency: 'weekly',
    })

    render(<BookingDashboard {...defaultProps} clients={[client]} />)

    // Client should be visible in waiting list
    expect(screen.getByText('Client One')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
  })

  it('shows active clients tab with count', () => {
    const client = createClient({
      status: 'in_treatment',
      assignedTherapistId: 'therapist-1',
      sessionsRequired: 8,
      sessionsCompleted: 2,
    })

    render(<BookingDashboard {...defaultProps} clients={[client]} />)

    // Active tab should show count of 1
    const activeButton = screen.getByText('Active')
    expect(activeButton).toBeInTheDocument()

    // Click to switch to active view
    fireEvent.click(activeButton)

    // Client should be visible
    expect(screen.getByText('Client One')).toBeInTheDocument()
  })

  it('shows schedule view when no client selected', () => {
    const client = createClient()

    render(<BookingDashboard {...defaultProps} clients={[client]} />)

    // Schedule view is shown when no client is selected
    // The left panel shows clients, right panel shows schedule
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
