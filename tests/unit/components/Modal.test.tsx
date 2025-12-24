import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders in a portal when open', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Hello">
        <div>Body content</div>
      </Modal>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('makes the body scrollable (overflow-y-auto) for tall content', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Scrollable">
        <div>Lots of content</div>
      </Modal>
    )

    const modalBody = screen.getByTestId('modal-body')
    expect(modalBody.className).toContain('overflow-y-auto')

    const modalContent = screen.getByTestId('modal-content')
    expect(modalContent.className).toContain('max-h-')
  })

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Closable">
        <div>Body</div>
      </Modal>
    )

    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
