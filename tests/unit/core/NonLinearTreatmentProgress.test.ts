import { describe, it, expect } from 'vitest'
import { SessionManager, SESSION_CONFIG } from '@/core/session'

describe('Non-Linear Treatment Progress', () => {
  describe('calculateTreatmentProgress', () => {
    it('returns normal progress for average quality session', () => {
      const result = SessionManager.calculateTreatmentProgress(
        0.7, // 70% quality
        70, // 70% satisfaction
        false, // no crisis
        12345 // seed
      )

      expect(result.progressType).toBe('normal')
      expect(result.progressGained).toBeCloseTo(
        SESSION_CONFIG.PROGRESS_PER_QUALITY * 0.7,
        4
      )
      expect(result.description).toBe('Steady progress in treatment')
    })

    it('can trigger breakthrough for high quality sessions', () => {
      // Test with many seeds to find one that triggers breakthrough
      let breakthroughFound = false
      for (let seed = 0; seed < 1000; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.95, // 95% quality (above threshold)
          80,
          false,
          seed
        )

        if (result.progressType === 'breakthrough') {
          breakthroughFound = true
          expect(result.progressGained).toBeCloseTo(
            SESSION_CONFIG.PROGRESS_PER_QUALITY * 0.95 * SESSION_CONFIG.BREAKTHROUGH_MULTIPLIER,
            4
          )
          expect(result.description).toContain('breakthrough')
          break
        }
      }

      // With 20% chance and 1000 seeds, we should find at least one
      expect(breakthroughFound).toBe(true)
    })

    it('breakthrough requires quality >= BREAKTHROUGH_QUALITY_THRESHOLD', () => {
      // With quality below threshold, should never get breakthrough
      for (let seed = 0; seed < 100; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.85, // Below 0.9 threshold
          80,
          false,
          seed
        )

        // Should never be breakthrough with quality below threshold
        expect(result.progressType).not.toBe('breakthrough')
      }
    })

    it('can trigger plateau for low satisfaction clients', () => {
      let plateauFound = false
      for (let seed = 0; seed < 1000; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.6, // Normal quality
          30, // Low satisfaction (below 50 threshold)
          false,
          seed
        )

        if (result.progressType === 'plateau') {
          plateauFound = true
          expect(result.progressGained).toBeCloseTo(
            SESSION_CONFIG.PROGRESS_PER_QUALITY * 0.6 * SESSION_CONFIG.PLATEAU_MULTIPLIER,
            4
          )
          expect(result.description).toContain('plateau')
          break
        }
      }

      expect(plateauFound).toBe(true)
    })

    it('plateau requires satisfaction < PLATEAU_SATISFACTION_THRESHOLD', () => {
      // With satisfaction above threshold, should never get plateau
      for (let seed = 0; seed < 100; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.6,
          60, // Above 50 threshold
          false,
          seed
        )

        expect(result.progressType).not.toBe('plateau')
      }
    })

    it('can trigger regression after crisis decisions', () => {
      let regressionFound = false
      for (let seed = 0; seed < 1000; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.7,
          70,
          true, // Had crisis decision
          seed
        )

        if (result.progressType === 'regression') {
          regressionFound = true
          expect(result.progressGained).toBeLessThan(
            SESSION_CONFIG.PROGRESS_PER_QUALITY * 0.7
          )
          expect(result.description).toContain('setback')
          break
        }
      }

      expect(regressionFound).toBe(true)
    })

    it('regression only happens with crisis decisions', () => {
      // Without crisis decision, should never get regression
      for (let seed = 0; seed < 100; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.7,
          70,
          false, // No crisis
          seed
        )

        expect(result.progressType).not.toBe('regression')
      }
    })

    it('regression progress is never negative', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.1, // Very low quality
          30, // Low satisfaction
          true, // Crisis decision
          seed
        )

        expect(result.progressGained).toBeGreaterThanOrEqual(0)
      }
    })

    it('seeded random produces deterministic results', () => {
      const result1 = SessionManager.calculateTreatmentProgress(0.8, 60, false, 42)
      const result2 = SessionManager.calculateTreatmentProgress(0.8, 60, false, 42)

      expect(result1.progressType).toBe(result2.progressType)
      expect(result1.progressGained).toBe(result2.progressGained)
      expect(result1.description).toBe(result2.description)
    })

    it('different seeds can produce different results', () => {
      const results = new Set<string>()

      for (let seed = 0; seed < 100; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.95, // High quality to enable breakthrough
          30, // Low satisfaction to enable plateau
          true, // Crisis to enable regression
          seed
        )
        results.add(result.progressType)
      }

      // With all conditions enabled, we should see variety
      expect(results.size).toBeGreaterThan(1)
    })

    it('works without seed (uses Math.random)', () => {
      // Just verify it doesn't crash without a seed
      const result = SessionManager.calculateTreatmentProgress(
        0.7,
        70,
        false
        // no seed
      )

      expect(result.progressGained).toBeGreaterThan(0)
      expect(['normal', 'breakthrough', 'plateau', 'regression']).toContain(
        result.progressType
      )
    })
  })

  describe('SESSION_CONFIG non-linear constants', () => {
    it('BREAKTHROUGH_QUALITY_THRESHOLD is reasonable', () => {
      expect(SESSION_CONFIG.BREAKTHROUGH_QUALITY_THRESHOLD).toBeGreaterThanOrEqual(0.8)
      expect(SESSION_CONFIG.BREAKTHROUGH_QUALITY_THRESHOLD).toBeLessThanOrEqual(1.0)
    })

    it('BREAKTHROUGH_CHANCE is not too high or low', () => {
      expect(SESSION_CONFIG.BREAKTHROUGH_CHANCE).toBeGreaterThan(0)
      expect(SESSION_CONFIG.BREAKTHROUGH_CHANCE).toBeLessThanOrEqual(0.5)
    })

    it('BREAKTHROUGH_MULTIPLIER gives bonus progress', () => {
      expect(SESSION_CONFIG.BREAKTHROUGH_MULTIPLIER).toBeGreaterThan(1)
    })

    it('PLATEAU_CHANCE is not too high or low', () => {
      expect(SESSION_CONFIG.PLATEAU_CHANCE).toBeGreaterThan(0)
      expect(SESSION_CONFIG.PLATEAU_CHANCE).toBeLessThanOrEqual(0.5)
    })

    it('PLATEAU_MULTIPLIER reduces progress', () => {
      expect(SESSION_CONFIG.PLATEAU_MULTIPLIER).toBeGreaterThan(0)
      expect(SESSION_CONFIG.PLATEAU_MULTIPLIER).toBeLessThan(1)
    })

    it('PLATEAU_SATISFACTION_THRESHOLD is reasonable', () => {
      expect(SESSION_CONFIG.PLATEAU_SATISFACTION_THRESHOLD).toBeGreaterThan(0)
      expect(SESSION_CONFIG.PLATEAU_SATISFACTION_THRESHOLD).toBeLessThan(100)
    })

    it('REGRESSION_AMOUNT is small but meaningful', () => {
      expect(SESSION_CONFIG.REGRESSION_AMOUNT).toBeGreaterThan(0)
      expect(SESSION_CONFIG.REGRESSION_AMOUNT).toBeLessThan(0.1) // Less than 10%
    })
  })

  describe('progress ordering priority', () => {
    it('regression is checked before breakthrough', () => {
      // With crisis + high quality, regression should have chance to trigger first
      let regressionFoundWithHighQuality = false

      for (let seed = 0; seed < 1000; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.95, // High quality (would qualify for breakthrough)
          70,
          true, // Crisis decision
          seed
        )

        if (result.progressType === 'regression') {
          regressionFoundWithHighQuality = true
          break
        }
      }

      expect(regressionFoundWithHighQuality).toBe(true)
    })

    it('breakthrough is checked before plateau', () => {
      // With high quality + low satisfaction, breakthrough should be possible
      let breakthroughFoundWithLowSatisfaction = false

      for (let seed = 0; seed < 1000; seed++) {
        const result = SessionManager.calculateTreatmentProgress(
          0.95, // High quality
          30, // Low satisfaction (would qualify for plateau)
          false, // No crisis
          seed
        )

        if (result.progressType === 'breakthrough') {
          breakthroughFoundWithLowSatisfaction = true
          break
        }
      }

      expect(breakthroughFoundWithLowSatisfaction).toBe(true)
    })
  })
})
