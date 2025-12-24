import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheatModal } from '@/components/game/CheatModal'
import { useGameStore } from '@/store/gameStore'

describe('CheatModal', () => {
  beforeEach(() => {
    useGameStore.setState({
      balance: 5000,
      reputation: 20,
      practiceLevel: 1,
      currentDay: 1,
      transactionHistory: [],
    })
  })

  it('updates balance and reputation in store on Apply', () => {
    const onClose = vi.fn()

    render(<CheatModal open onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Balance'), { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText('Reputation'), { target: { value: '250' } })

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    const state = useGameStore.getState()
    expect(state.balance).toBe(12345)
    expect(state.reputation).toBe(250)
    expect(state.practiceLevel).toBe(4)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
