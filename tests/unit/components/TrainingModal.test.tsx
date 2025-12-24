import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TrainingModal } from '@/components'
import type { Therapist } from '@/core/types'

function createTherapist(overrides: Partial<Therapist> = {}): Therapist {
  return {
    id: 't-1',
    displayName: 'Dr. Test',
    isPlayer: false,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 50,
    level: 5,
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

describe('TrainingModal', () => {
  it('starts a training program when affordable and prerequisites met', () => {
    const onStartTraining = vi.fn()
    const onClose = vi.fn()

    render(
      <TrainingModal
        therapist={createTherapist()}
        currentBalance={5000}
        onStartTraining={onStartTraining}
        onClose={onClose}
      />
    )

    // Pick the cheapest/always-available program.
    expect(screen.getByText('Telehealth Certification')).toBeInTheDocument()

    const telehealthHeading = screen.getByText('Telehealth Certification')
    const telehealthCard = telehealthHeading.parentElement?.parentElement
    expect(telehealthCard).toBeTruthy()

    const startButton = within(telehealthCard as HTMLElement).getByRole('button', { name: 'Start Training' })
    fireEvent.click(startButton)

    expect(onStartTraining).toHaveBeenCalledTimes(1)
    expect(onStartTraining).toHaveBeenCalledWith('t-1', 'telehealth_training')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables training when funds are insufficient', () => {
    render(
      <TrainingModal
        therapist={createTherapist()}
        currentBalance={0}
        onStartTraining={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Telehealth Certification')).toBeInTheDocument()

    const needMore = screen.getByRole('button', { name: /Need \$500 more/ })
    expect(needMore).toBeDisabled()
  })
})
