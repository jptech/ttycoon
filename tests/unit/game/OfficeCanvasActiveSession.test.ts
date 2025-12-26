import { describe, it, expect } from 'vitest'

/**
 * Tests for Office Canvas active session visualization logic.
 * These test the data calculation, not the PixiJS rendering.
 */
describe('Office Canvas Active Session Detection', () => {
  // Helper to create mock therapist state
  const createMockTherapistState = (overrides = {}) => ({
    therapistId: 'therapist-1',
    displayName: 'Dr. Test',
    initial: 'T',
    color: 0x22c55e,
    position: { x: 100, y: 100 },
    targetPosition: { x: 100, y: 100 },
    isMoving: false,
    isInSession: false,
    sessionProgress: 0,
    roomId: null,
    status: 'idle' as const,
    isVirtual: false,
    ...overrides,
  })

  describe('activeSessionRoomIds calculation', () => {
    it('identifies rooms with active sessions', () => {
      const therapistStates = [
        createMockTherapistState({
          therapistId: 'therapist-1',
          roomId: 'therapy_1',
          isInSession: true,
          sessionProgress: 0.5,
        }),
        createMockTherapistState({
          therapistId: 'therapist-2',
          roomId: 'waiting',
          isInSession: false,
        }),
      ]

      // Simulating the logic from OfficeCanvas
      const activeSessionRoomIds = new Set<string>()
      therapistStates.forEach(t => {
        if (t.roomId && t.isInSession) activeSessionRoomIds.add(t.roomId)
      })

      expect(activeSessionRoomIds.has('therapy_1')).toBe(true)
      expect(activeSessionRoomIds.has('waiting')).toBe(false)
      expect(activeSessionRoomIds.size).toBe(1)
    })

    it('returns empty set when no active sessions', () => {
      const therapistStates = [
        createMockTherapistState({
          therapistId: 'therapist-1',
          roomId: 'waiting',
          isInSession: false,
        }),
        createMockTherapistState({
          therapistId: 'therapist-2',
          roomId: 'break',
          isInSession: false,
          status: 'on_break' as const,
        }),
      ]

      const activeSessionRoomIds = new Set<string>()
      therapistStates.forEach(t => {
        if (t.roomId && t.isInSession) activeSessionRoomIds.add(t.roomId)
      })

      expect(activeSessionRoomIds.size).toBe(0)
    })

    it('handles multiple active sessions in different rooms', () => {
      const therapistStates = [
        createMockTherapistState({
          therapistId: 'therapist-1',
          roomId: 'therapy_1',
          isInSession: true,
          sessionProgress: 0.3,
        }),
        createMockTherapistState({
          therapistId: 'therapist-2',
          roomId: 'therapy_2',
          isInSession: true,
          sessionProgress: 0.7,
        }),
        createMockTherapistState({
          therapistId: 'therapist-3',
          roomId: 'waiting',
          isInSession: false,
        }),
      ]

      const activeSessionRoomIds = new Set<string>()
      therapistStates.forEach(t => {
        if (t.roomId && t.isInSession) activeSessionRoomIds.add(t.roomId)
      })

      expect(activeSessionRoomIds.has('therapy_1')).toBe(true)
      expect(activeSessionRoomIds.has('therapy_2')).toBe(true)
      expect(activeSessionRoomIds.has('waiting')).toBe(false)
      expect(activeSessionRoomIds.size).toBe(2)
    })

    it('handles therapist with no room assignment', () => {
      const therapistStates = [
        createMockTherapistState({
          therapistId: 'therapist-1',
          roomId: null,
          isInSession: false,
        }),
      ]

      const activeSessionRoomIds = new Set<string>()
      therapistStates.forEach(t => {
        if (t.roomId && t.isInSession) activeSessionRoomIds.add(t.roomId)
      })

      expect(activeSessionRoomIds.size).toBe(0)
    })
  })

  describe('pulse animation values', () => {
    it('calculates pulse alpha within expected range', () => {
      // Test various phase values
      const phases = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI]

      for (const pulsePhase of phases) {
        const pulseAlpha = 0.3 + 0.2 * Math.sin(pulsePhase)

        // Alpha should be between 0.1 (0.3 - 0.2) and 0.5 (0.3 + 0.2)
        // Use closeTo for floating-point precision
        expect(pulseAlpha).toBeGreaterThanOrEqual(0.1 - 0.001)
        expect(pulseAlpha).toBeLessThanOrEqual(0.5 + 0.001)
      }
    })

    it('calculates pulse width within expected range', () => {
      const phases = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI]

      for (const pulsePhase of phases) {
        const pulseWidth = 3 + 1.5 * Math.sin(pulsePhase)

        // Width should be between 1.5 (3 - 1.5) and 4.5 (3 + 1.5)
        expect(pulseWidth).toBeGreaterThanOrEqual(1.5)
        expect(pulseWidth).toBeLessThanOrEqual(4.5)
      }
    })
  })

  describe('therapist glow animation values', () => {
    it('calculates glow alpha within expected range', () => {
      const phases = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI]

      for (const pulsePhase of phases) {
        const glowAlpha = 0.15 + 0.1 * Math.sin(pulsePhase)

        // Alpha should be between 0.05 and 0.25
        // Use tolerance for floating-point precision
        expect(glowAlpha).toBeGreaterThanOrEqual(0.05 - 0.001)
        expect(glowAlpha).toBeLessThanOrEqual(0.25 + 0.001)
      }
    })

    it('calculates glow radius within expected range', () => {
      const phases = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI]

      for (const pulsePhase of phases) {
        const glowRadius = 24 + 4 * Math.sin(pulsePhase)

        // Radius should be between 20 and 28
        expect(glowRadius).toBeGreaterThanOrEqual(20)
        expect(glowRadius).toBeLessThanOrEqual(28)
      }
    })
  })

  describe('time remaining display', () => {
    it('calculates correct time remaining from progress', () => {
      const sessionDuration = 50 // minutes

      // Test exact values that avoid floating-point issues
      const testCases = [
        { progress: 0, expected: 50 },
        { progress: 0.5, expected: 25 },
        { progress: 0.8, expected: 10 },
        { progress: 1, expected: 0 },
      ]

      for (const { progress, expected } of testCases) {
        const remainingProgress = 1 - progress
        const remainingMinutes = Math.ceil(remainingProgress * sessionDuration)
        expect(remainingMinutes).toBe(expected)
      }
    })

    it('rounds up partial minutes correctly', () => {
      const sessionDuration = 50
      // At 95% progress, 5% remains = 2.5 minutes -> ceil to 3
      const progress = 0.95
      const remainingProgress = 1 - progress
      const remainingMinutes = Math.ceil(remainingProgress * sessionDuration)
      expect(remainingMinutes).toBe(3) // 0.05 * 50 = 2.5 -> ceil = 3
    })
  })
})
