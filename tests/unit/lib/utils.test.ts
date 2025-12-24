import { describe, it, expect } from 'vitest'
import { cn, formatMoney, formatTime, clamp } from '@/lib/utils'

describe('cn (class name utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  it('merges tailwind classes with proper precedence', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })
})

describe('formatMoney', () => {
  it('formats positive amounts', () => {
    expect(formatMoney(5000)).toBe('$5,000')
    expect(formatMoney(100)).toBe('$100')
    expect(formatMoney(1234567)).toBe('$1,234,567')
  })

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0')
  })

  it('formats negative amounts', () => {
    expect(formatMoney(-500)).toBe('-$500')
  })
})

describe('formatTime', () => {
  it('formats morning times', () => {
    expect(formatTime(8, 0)).toBe('8:00 AM')
    expect(formatTime(9, 30)).toBe('9:30 AM')
    expect(formatTime(11, 45)).toBe('11:45 AM')
  })

  it('formats noon', () => {
    expect(formatTime(12, 0)).toBe('12:00 PM')
  })

  it('formats afternoon times', () => {
    expect(formatTime(13, 0)).toBe('1:00 PM')
    expect(formatTime(17, 0)).toBe('5:00 PM')
  })

  it('pads minutes with leading zero', () => {
    expect(formatTime(9, 5)).toBe('9:05 AM')
  })
})

describe('clamp', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps values below minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps values above maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('handles edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})
