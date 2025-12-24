import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@/components/ui'

describe('ProgressBar', () => {
  it('renders with correct aria attributes', () => {
    render(<ProgressBar value={50} />)
    const progressbar = screen.getByRole('progressbar')

    expect(progressbar).toHaveAttribute('aria-valuenow', '50')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('calculates percentage correctly', () => {
    render(<ProgressBar value={75} />)
    const fill = screen.getByRole('progressbar').firstChild as HTMLElement

    expect(fill).toHaveStyle({ width: '75%' })
  })

  it('handles custom max value', () => {
    render(<ProgressBar value={50} max={200} />)
    const fill = screen.getByRole('progressbar').firstChild as HTMLElement

    expect(fill).toHaveStyle({ width: '25%' })
  })

  it('clamps value between 0 and 100%', () => {
    const { rerender } = render(<ProgressBar value={-10} />)
    let fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveStyle({ width: '0%' })

    rerender(<ProgressBar value={150} />)
    fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveStyle({ width: '100%' })
  })

  it('applies variant colors', () => {
    const { rerender } = render(<ProgressBar value={50} variant="default" />)
    let fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('bg-primary')

    rerender(<ProgressBar value={50} variant="success" />)
    fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('bg-success')

    rerender(<ProgressBar value={50} variant="warning" />)
    fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('bg-warning')

    rerender(<ProgressBar value={50} variant="error" />)
    fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('bg-error')

    rerender(<ProgressBar value={50} variant="info" />)
    fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('bg-info')
  })

  it('applies size classes', () => {
    const { rerender } = render(<ProgressBar value={50} size="sm" />)
    expect(screen.getByRole('progressbar')).toHaveClass('h-1')

    rerender(<ProgressBar value={50} size="md" />)
    expect(screen.getByRole('progressbar')).toHaveClass('h-2')

    rerender(<ProgressBar value={50} size="lg" />)
    expect(screen.getByRole('progressbar')).toHaveClass('h-3')
  })

  it('shows label when showLabel is true', () => {
    render(<ProgressBar value={75} showLabel />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('hides label by default', () => {
    render(<ProgressBar value={75} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('applies animation class when animated', () => {
    render(<ProgressBar value={50} animated />)
    const fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).toHaveClass('transition-all')
  })

  it('removes animation class when not animated', () => {
    render(<ProgressBar value={50} animated={false} />)
    const fill = screen.getByRole('progressbar').firstChild as HTMLElement
    expect(fill).not.toHaveClass('transition-all')
  })
})
