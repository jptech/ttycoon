import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useGameLoop } from '@/hooks/useGameLoop'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'

const engine = {
  start: vi.fn(),
  stop: vi.fn(),
  skipToNextSession: vi.fn(() => true),
  getNextSessionTime: vi.fn(() => null),
}

vi.mock('@/core/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/engine')>()
  return {
    ...actual,
    getGameEngine: vi.fn(() => engine),
  }
})

function HookHarness() {
  useGameLoop()
  return null
}

describe('useGameLoop modal pause synchronization', () => {
  beforeEach(() => {
    useGameStore.setState({
      isPaused: false,
      pauseReasons: [],
      gameSpeed: 1,
    })

    useUIStore.setState({
      activeModal: null,
      modalStack: [],
    })
  })

  it('pauses on modal open and resumes on modal close', () => {
    render(<HookHarness />)

    act(() => {
      useUIStore.getState().openModal('settings')
    })
    expect(useGameStore.getState().isPaused).toBe(true)
    expect(useGameStore.getState().pauseReasons).toContain('modal_settings')

    act(() => {
      useUIStore.getState().closeModal()
    })
    expect(useGameStore.getState().pauseReasons).not.toContain('modal_settings')
    expect(useGameStore.getState().isPaused).toBe(false)
  })

  it('switches pause reason when stacking modals', () => {
    render(<HookHarness />)

    act(() => {
      useUIStore.getState().openModal('settings')
    })
    expect(useGameStore.getState().pauseReasons).toContain('modal_settings')

    act(() => {
      useUIStore.getState().openModal('help')
    })
    expect(useGameStore.getState().pauseReasons).not.toContain('modal_settings')
    expect(useGameStore.getState().pauseReasons).toContain('modal_help')

    // Close help -> returns to settings (modal stack)
    act(() => {
      useUIStore.getState().closeModal()
    })
    expect(useGameStore.getState().pauseReasons).not.toContain('modal_help')
    expect(useGameStore.getState().pauseReasons).toContain('modal_settings')

    // Close settings -> no modal pause remains
    act(() => {
      useUIStore.getState().closeModal()
    })
    expect(useGameStore.getState().pauseReasons).not.toContain('modal_settings')
    expect(useGameStore.getState().isPaused).toBe(false)
  })

  it('does not clear other pause reasons when closing a modal', () => {
    render(<HookHarness />)

    act(() => {
      useGameStore.getState().pause('manual')
    })
    expect(useGameStore.getState().isPaused).toBe(true)

    act(() => {
      useUIStore.getState().openModal('settings')
    })
    expect(useGameStore.getState().pauseReasons).toContain('manual')
    expect(useGameStore.getState().pauseReasons).toContain('modal_settings')

    act(() => {
      useUIStore.getState().closeModal()
    })
    expect(useGameStore.getState().pauseReasons).toContain('manual')
    expect(useGameStore.getState().pauseReasons).not.toContain('modal_settings')
    expect(useGameStore.getState().isPaused).toBe(true)
  })
})
