import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'

import { useTrainingProcessor } from '@/hooks'
import { useGameStore, useUIStore } from '@/store'
import { EventBus, GameEvents } from '@/core/events'
import type { Therapist } from '@/core/types'

function createTherapist(id: string, overrides: Partial<Therapist> = {}): Therapist {
  return {
    id,
    displayName: `Dr. ${id}`,
    isPlayer: false,
    energy: 100,
    maxEnergy: 100,
    baseSkill: 60,
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

function HookHarness(props: { onReady: (api: ReturnType<typeof useTrainingProcessor>) => void }) {
  const api = useTrainingProcessor({ enabled: true })
  useEffect(() => {
    props.onReady(api)
  }, [api, props])
  return null
}

describe('Training end-to-end (enroll → progress time → complete)', () => {
  beforeEach(() => {
    useGameStore.setState({
      currentDay: 1,
      balance: 10000,
      therapists: [],
      activeTrainings: [],
    })
    useUIStore.setState({ notifications: [] })
  })

  it('enrolls a therapist, deducts funds, and sets status', () => {
    const therapist = createTherapist('t-1')
    useGameStore.setState({ therapists: [therapist] })

    let api: ReturnType<typeof useTrainingProcessor> | null = null
    render(<HookHarness onReady={(a) => (api = a)} />)

    const ok = api!.startTraining(therapist.id, 'telehealth_training')
    expect(ok).toBe(true)

    const state = useGameStore.getState()
    expect(state.balance).toBe(9500)
    expect(state.therapists[0].status).toBe('in_training')
    expect(state.activeTrainings).toHaveLength(1)
    expect(state.activeTrainings[0]).toMatchObject({
      therapistId: therapist.id,
      programId: 'telehealth_training',
      hoursCompleted: 0,
      totalHours: 8,
    })
  })

  it('advances training across days and awards certification + skill on completion', () => {
    const therapist = createTherapist('t-1', { baseSkill: 60 })
    useGameStore.setState({ therapists: [therapist] })

    let api: ReturnType<typeof useTrainingProcessor> | null = null
    const view = render(<HookHarness onReady={(a) => (api = a)} />)

    expect(api!.startTraining(therapist.id, 'cbt_training')).toBe(true)

    // Day 2: +8h
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 2 })
    expect(useGameStore.getState().activeTrainings[0].hoursCompleted).toBe(8)

    // Day 3: +8h
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 3 })
    expect(useGameStore.getState().activeTrainings[0].hoursCompleted).toBe(16)

    // Day 4: completes (24h total)
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 4 })

    const state = useGameStore.getState()
    expect(state.activeTrainings).toHaveLength(0)

    const updatedTherapist = state.therapists.find((t) => t.id === therapist.id)!
    expect(updatedTherapist.status).toBe('available')
    expect(updatedTherapist.certifications).toContain('cbt_certified')
    expect(updatedTherapist.baseSkill).toBe(63)

    view.unmount()
  })

  it('supports multiple therapists enrolled in the same program concurrently', () => {
    const t1 = createTherapist('t-1')
    const t2 = createTherapist('t-2')
    useGameStore.setState({ therapists: [t1, t2] })

    let api: ReturnType<typeof useTrainingProcessor> | null = null
    const view = render(<HookHarness onReady={(a) => (api = a)} />)

    expect(api!.startTraining(t1.id, 'telehealth_training')).toBe(true)
    expect(api!.startTraining(t2.id, 'telehealth_training')).toBe(true)

    expect(useGameStore.getState().activeTrainings).toHaveLength(2)

    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: 2 })

    const state = useGameStore.getState()
    expect(state.activeTrainings).toHaveLength(0)

    const u1 = state.therapists.find((t) => t.id === t1.id)!
    const u2 = state.therapists.find((t) => t.id === t2.id)!

    expect(u1.certifications).toContain('telehealth_certified')
    expect(u2.certifications).toContain('telehealth_certified')
    expect(u1.status).toBe('available')
    expect(u2.status).toBe('available')

    view.unmount()
  })
})
