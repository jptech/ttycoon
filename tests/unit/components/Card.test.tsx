import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui'

describe('Card', () => {
  it('renders with children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default variant', () => {
    render(<Card data-testid="card">Default</Card>)
    expect(screen.getByTestId('card')).toHaveClass('bg-card', 'border')
  })

  it('applies outlined variant', () => {
    render(<Card variant="outlined">Outlined</Card>)
    expect(screen.getByText('Outlined')).toHaveClass('bg-transparent', 'border-2')
  })

  it('applies elevated variant', () => {
    render(<Card variant="elevated">Elevated</Card>)
    expect(screen.getByText('Elevated')).toHaveClass('shadow-md')
  })

  it('applies custom className', () => {
    render(<Card className="custom-card">Custom</Card>)
    expect(screen.getByText('Custom')).toHaveClass('custom-card')
  })
})

describe('CardHeader', () => {
  it('renders with children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('has margin-bottom class', () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText('Header')).toHaveClass('mb-4')
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title')
  })

  it('applies font styling', () => {
    render(<CardTitle>Styled Title</CardTitle>)
    expect(screen.getByText('Styled Title')).toHaveClass('font-semibold', 'text-lg')
  })
})

describe('CardContent', () => {
  it('renders with children', () => {
    render(<CardContent>Content here</CardContent>)
    expect(screen.getByText('Content here')).toBeInTheDocument()
  })
})

describe('CardFooter', () => {
  it('renders with children', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('applies flex layout', () => {
    render(<CardFooter>Footer</CardFooter>)
    expect(screen.getByText('Footer')).toHaveClass('flex', 'items-center', 'gap-2')
  })
})

describe('Card composition', () => {
  it('renders full card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Main content</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'Test Card' })).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
    expect(screen.getByText('Footer actions')).toBeInTheDocument()
  })
})
