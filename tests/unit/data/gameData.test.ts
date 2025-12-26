import { describe, it, expect } from 'vitest'
import {
  INSURANCE_PANELS,
  getInsurancePanel,
  getInsurancePanelsSortedByReputation,
  getAvailablePanels,
  getDenialRates,
} from '@/data/insurancePanels'
import {
  BUILDINGS,
  getBuilding,
  getBuildingsSorted,
  getAvailableUpgrades,
  getBuildingRent,
  getDailyRent,
} from '@/data/buildings'
import {
  CONDITION_WEIGHTS,
  TIME_PREFERENCE_WEIGHTS,
  FREQUENCY_BY_CONDITION,
  SESSION_RATES,
  INTAKE_REASONS,
  getWeightedConditionCategory,
  getWeightedTimePreference,
  getFrequencyForCondition,
  getSessionRate,
  getIntakeReason,
  getClientSpawnChance,
  getClientSpawnAttempts,
} from '@/data/clientGeneration'
import {
  TRAINING_PROGRAMS,
  getTrainingProgram,
  getTrainingProgramsSorted,
  getTrainingProgramsByTrack,
  getCertificationPrograms,
  getSkillPrograms,
  getProgramForCertification,
  formatTrainingDuration,
} from '@/data/trainingPrograms'
import {
  RANDOM_EVENTS,
  COMMON_MODIFIERS,
  getRandomEvent,
  getAllRandomEvents,
  getRandomEventsByType,
  getEligibleRandomEvents,
  createModifierInstance,
} from '@/data/randomEvents'
import {
  DECISION_EVENTS,
  getDecisionEvent,
  getAllDecisionEvents,
  getEligibleDecisionEvents,
  getGeneralDecisionEvents,
  getDecisionEventsForCondition,
  getAverageOptimalQualityGain,
} from '@/data/decisionEvents'

describe('Insurance Panels', () => {
  describe('INSURANCE_PANELS', () => {
    it('has all expected insurers', () => {
      expect(INSURANCE_PANELS.aetna).toBeDefined()
      expect(INSURANCE_PANELS.bluecross).toBeDefined()
      expect(INSURANCE_PANELS.cigna).toBeDefined()
      expect(INSURANCE_PANELS.united).toBeDefined()
      expect(INSURANCE_PANELS.medicaid).toBeDefined()
    })

    it('each panel has required properties', () => {
      for (const panel of Object.values(INSURANCE_PANELS)) {
        expect(panel.id).toBeDefined()
        expect(panel.name).toBeDefined()
        expect(panel.reimbursement).toBeGreaterThan(0)
        expect(panel.delayDays).toBeGreaterThan(0)
        expect(panel.denialRate).toBeGreaterThanOrEqual(0)
        expect(panel.denialRate).toBeLessThanOrEqual(1)
        expect(panel.applicationFee).toBeGreaterThanOrEqual(0)
        expect(panel.minReputation).toBeGreaterThanOrEqual(0)
      }
    })

    it('medicaid has no application fee', () => {
      expect(INSURANCE_PANELS.medicaid.applicationFee).toBe(0)
    })

    it('medicaid has lowest reimbursement', () => {
      const medicaidRate = INSURANCE_PANELS.medicaid.reimbursement
      for (const [id, panel] of Object.entries(INSURANCE_PANELS)) {
        if (id !== 'medicaid') {
          expect(panel.reimbursement).toBeGreaterThan(medicaidRate)
        }
      }
    })
  })

  describe('getInsurancePanel', () => {
    it('returns correct panel by id', () => {
      const panel = getInsurancePanel('aetna')
      expect(panel.name).toBe('Aetna')
    })
  })

  describe('getInsurancePanelsSortedByReputation', () => {
    it('returns panels sorted by reputation requirement', () => {
      const sorted = getInsurancePanelsSortedByReputation()

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].minReputation).toBeLessThanOrEqual(sorted[i + 1].minReputation)
      }
    })

    it('medicaid is first (lowest reputation requirement)', () => {
      const sorted = getInsurancePanelsSortedByReputation()
      expect(sorted[0].id).toBe('medicaid')
    })
  })

  describe('getAvailablePanels', () => {
    it('returns only panels with reputation requirement met', () => {
      const available = getAvailablePanels(40)

      for (const panel of available) {
        expect(panel.minReputation).toBeLessThanOrEqual(40)
      }
    })

    it('returns all panels at high reputation', () => {
      const available = getAvailablePanels(500)
      expect(available.length).toBe(Object.keys(INSURANCE_PANELS).length)
    })

    it('returns at least medicaid at zero reputation', () => {
      const available = getAvailablePanels(0)
      expect(available.length).toBeGreaterThanOrEqual(1)
      expect(available.some((p) => p.id === 'medicaid')).toBe(true)
    })
  })

  describe('getDenialRates', () => {
    it('returns denial rates for all insurers', () => {
      const rates = getDenialRates()

      expect(rates.aetna).toBeDefined()
      expect(rates.bluecross).toBeDefined()
      expect(rates.cigna).toBeDefined()
      expect(rates.united).toBeDefined()
      expect(rates.medicaid).toBeDefined()
    })

    it('rates match panel data', () => {
      const rates = getDenialRates()

      expect(rates.aetna).toBe(INSURANCE_PANELS.aetna.denialRate)
      expect(rates.medicaid).toBe(INSURANCE_PANELS.medicaid.denialRate)
    })
  })
})

describe('Buildings', () => {
  describe('BUILDINGS', () => {
    it('has starter_suite as starting building', () => {
      expect(BUILDINGS.starter_suite).toBeDefined()
      expect(BUILDINGS.starter_suite.requiredLevel).toBe(1)
    })

    it('each building has required properties', () => {
      for (const building of Object.values(BUILDINGS)) {
        expect(building.id).toBeDefined()
        expect(building.name).toBeDefined()
        expect(building.tier).toBeGreaterThanOrEqual(1)
        expect(building.tier).toBeLessThanOrEqual(3)
        expect(building.rooms).toBeGreaterThan(0)
        expect(building.monthlyRent).toBeGreaterThan(0)
        expect(building.requiredLevel).toBeGreaterThanOrEqual(1)
      }
    })

    it('higher tier buildings have more rooms', () => {
      const tier1 = Object.values(BUILDINGS).filter((b) => b.tier === 1)
      const tier2 = Object.values(BUILDINGS).filter((b) => b.tier === 2)
      const tier3 = Object.values(BUILDINGS).filter((b) => b.tier === 3)

      const maxTier1Rooms = Math.max(...tier1.map((b) => b.rooms))
      const minTier2Rooms = Math.min(...tier2.map((b) => b.rooms))
      const minTier3Rooms = Math.min(...tier3.map((b) => b.rooms))

      expect(minTier2Rooms).toBeGreaterThanOrEqual(maxTier1Rooms)
      expect(minTier3Rooms).toBeGreaterThanOrEqual(minTier2Rooms)
    })
  })

  describe('getBuilding', () => {
    it('returns building by id', () => {
      const building = getBuilding('starter_suite')
      expect(building?.name).toBe('Starter Suite')
    })

    it('returns undefined for invalid id', () => {
      const building = getBuilding('nonexistent')
      expect(building).toBeUndefined()
    })
  })

  describe('getBuildingsSorted', () => {
    it('sorts buildings by tier and rent', () => {
      const sorted = getBuildingsSorted()

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]

        if (current.tier === next.tier) {
          expect(current.monthlyRent).toBeLessThanOrEqual(next.monthlyRent)
        } else {
          expect(current.tier).toBeLessThanOrEqual(next.tier)
        }
      }
    })
  })

  describe('getAvailableUpgrades', () => {
    it('returns buildings available at practice level', () => {
      const upgrades = getAvailableUpgrades('starter_suite', 3)

      for (const upgrade of upgrades) {
        expect(upgrade.requiredLevel).toBeLessThanOrEqual(3)
        expect(upgrade.id).not.toBe('starter_suite')
      }
    })

    it('excludes current building', () => {
      const upgrades = getAvailableUpgrades('starter_suite', 5)
      expect(upgrades.some((b) => b.id === 'starter_suite')).toBe(false)
    })

    it('returns empty for invalid building id', () => {
      const upgrades = getAvailableUpgrades('nonexistent', 5)
      expect(upgrades.length).toBe(0)
    })
  })

  describe('getBuildingRent', () => {
    it('returns monthly rent for building', () => {
      const rent = getBuildingRent('starter_suite')
      expect(rent).toBe(BUILDINGS.starter_suite.monthlyRent)
    })

    it('returns 0 for invalid building', () => {
      const rent = getBuildingRent('nonexistent')
      expect(rent).toBe(0)
    })
  })

  describe('getDailyRent', () => {
    it('calculates daily rent from monthly', () => {
      const dailyRent = getDailyRent('starter_suite')
      const expected = Math.round(BUILDINGS.starter_suite.monthlyRent / 30)
      expect(dailyRent).toBe(expected)
    })

    it('returns 0 for invalid building', () => {
      const dailyRent = getDailyRent('nonexistent')
      expect(dailyRent).toBe(0)
    })
  })
})

describe('Client Generation', () => {
  describe('CONDITION_WEIGHTS', () => {
    it('has all condition categories', () => {
      expect(CONDITION_WEIGHTS.anxiety).toBeDefined()
      expect(CONDITION_WEIGHTS.depression).toBeDefined()
      expect(CONDITION_WEIGHTS.trauma).toBeDefined()
      expect(CONDITION_WEIGHTS.stress).toBeDefined()
      expect(CONDITION_WEIGHTS.relationship).toBeDefined()
      expect(CONDITION_WEIGHTS.behavioral).toBeDefined()
    })

    it('all weights are positive', () => {
      for (const weight of Object.values(CONDITION_WEIGHTS)) {
        expect(weight).toBeGreaterThan(0)
      }
    })
  })

  describe('getWeightedConditionCategory', () => {
    it('returns a valid condition category', () => {
      const category = getWeightedConditionCategory()
      expect(Object.keys(CONDITION_WEIGHTS)).toContain(category)
    })

    it('returns deterministic results with seeded random', () => {
      let seed = 12345
      const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const result1 = getWeightedConditionCategory(seededRandom)

      // Reset seed
      seed = 12345
      const result2 = getWeightedConditionCategory(seededRandom)

      expect(result1).toBe(result2)
    })
  })

  describe('TIME_PREFERENCE_WEIGHTS', () => {
    it('has all time preferences', () => {
      expect(TIME_PREFERENCE_WEIGHTS.morning).toBeDefined()
      expect(TIME_PREFERENCE_WEIGHTS.afternoon).toBeDefined()
      expect(TIME_PREFERENCE_WEIGHTS.evening).toBeDefined()
      expect(TIME_PREFERENCE_WEIGHTS.any).toBeDefined()
    })
  })

  describe('getWeightedTimePreference', () => {
    it('returns a valid time preference', () => {
      const pref = getWeightedTimePreference()
      expect(Object.keys(TIME_PREFERENCE_WEIGHTS)).toContain(pref)
    })
  })

  describe('FREQUENCY_BY_CONDITION', () => {
    it('has frequency options for all conditions', () => {
      for (const category of Object.keys(CONDITION_WEIGHTS)) {
        expect(FREQUENCY_BY_CONDITION[category as keyof typeof FREQUENCY_BY_CONDITION]).toBeDefined()
        expect(FREQUENCY_BY_CONDITION[category as keyof typeof FREQUENCY_BY_CONDITION].length).toBeGreaterThan(0)
      }
    })
  })

  describe('getFrequencyForCondition', () => {
    it('returns valid frequency for anxiety', () => {
      const freq = getFrequencyForCondition('anxiety')
      expect(['once', 'weekly', 'biweekly', 'monthly']).toContain(freq)
    })
  })

  describe('SESSION_RATES', () => {
    it('has higher rates for private pay', () => {
      expect(SESSION_RATES.privatePay.min).toBeGreaterThan(SESSION_RATES.insurance.min)
      expect(SESSION_RATES.privatePay.max).toBeGreaterThan(SESSION_RATES.insurance.max)
    })
  })

  describe('getSessionRate', () => {
    it('returns rate in private pay range', () => {
      const rate = getSessionRate(true)
      expect(rate).toBeGreaterThanOrEqual(SESSION_RATES.privatePay.min)
      expect(rate).toBeLessThanOrEqual(SESSION_RATES.privatePay.max)
    })

    it('returns rate in insurance range', () => {
      const rate = getSessionRate(false)
      expect(rate).toBeGreaterThanOrEqual(SESSION_RATES.insurance.min)
      expect(rate).toBeLessThanOrEqual(SESSION_RATES.insurance.max)
    })
  })

  describe('INTAKE_REASONS', () => {
    it('has reasons for all conditions', () => {
      for (const category of Object.keys(CONDITION_WEIGHTS)) {
        expect(INTAKE_REASONS[category as keyof typeof INTAKE_REASONS]).toBeDefined()
        expect(INTAKE_REASONS[category as keyof typeof INTAKE_REASONS].length).toBeGreaterThan(0)
      }
    })
  })

  describe('getIntakeReason', () => {
    it('returns a string for any condition', () => {
      const reason = getIntakeReason('anxiety')
      expect(typeof reason).toBe('string')
      expect(reason.length).toBeGreaterThan(0)
    })
  })

  describe('getClientSpawnChance', () => {
    it('returns higher chance with more days', () => {
      const earlyChance = getClientSpawnChance(1, 50)
      const lateChance = getClientSpawnChance(50, 50)

      expect(lateChance).toBeGreaterThan(earlyChance)
    })

    it('returns higher chance with more reputation', () => {
      const lowRepChance = getClientSpawnChance(30, 10)
      const highRepChance = getClientSpawnChance(30, 100)

      expect(highRepChance).toBeGreaterThan(lowRepChance)
    })

    it('caps at 80%', () => {
      const maxChance = getClientSpawnChance(1000, 500)
      expect(maxChance).toBeLessThanOrEqual(0.8)
    })
  })

  describe('getClientSpawnAttempts', () => {
    it('starts with 1 attempt', () => {
      expect(getClientSpawnAttempts(1)).toBe(1)
    })

    it('increases over time', () => {
      expect(getClientSpawnAttempts(15)).toBe(2)
      expect(getClientSpawnAttempts(40)).toBe(3)
      expect(getClientSpawnAttempts(100)).toBe(4)
    })
  })
})

describe('Training Programs', () => {
  describe('TRAINING_PROGRAMS', () => {
    it('has clinical track programs', () => {
      expect(TRAINING_PROGRAMS.trauma_training).toBeDefined()
      expect(TRAINING_PROGRAMS.couples_training).toBeDefined()
      expect(TRAINING_PROGRAMS.cbt_training).toBeDefined()
    })

    it('has business track programs', () => {
      expect(TRAINING_PROGRAMS.practice_management).toBeDefined()
      expect(TRAINING_PROGRAMS.insurance_billing).toBeDefined()
    })

    it('each program has required properties', () => {
      for (const program of Object.values(TRAINING_PROGRAMS)) {
        expect(program.id).toBeDefined()
        expect(program.name).toBeDefined()
        expect(program.description).toBeDefined()
        expect(['clinical', 'business']).toContain(program.track)
        expect(program.cost).toBeGreaterThan(0)
        expect(program.durationHours).toBeGreaterThan(0)
        expect(program.prerequisites).toBeDefined()
        expect(program.grants).toBeDefined()
      }
    })

    it('certification programs grant certifications', () => {
      expect(TRAINING_PROGRAMS.trauma_training.grants.certification).toBe('trauma_certified')
      expect(TRAINING_PROGRAMS.couples_training.grants.certification).toBe('couples_certified')
      expect(TRAINING_PROGRAMS.cbt_training.grants.certification).toBe('cbt_certified')
    })
  })

  describe('getTrainingProgram', () => {
    it('returns program by id', () => {
      const program = getTrainingProgram('trauma_training')
      expect(program?.name).toBe('Trauma-Informed Care Certification')
    })

    it('returns undefined for invalid id', () => {
      const program = getTrainingProgram('nonexistent')
      expect(program).toBeUndefined()
    })
  })

  describe('getTrainingProgramsSorted', () => {
    it('returns all programs', () => {
      const sorted = getTrainingProgramsSorted()
      expect(sorted.length).toBe(Object.keys(TRAINING_PROGRAMS).length)
    })

    it('sorts clinical before business', () => {
      const sorted = getTrainingProgramsSorted()
      const lastClinicalIndex = sorted.findLastIndex((p) => p.track === 'clinical')
      const firstBusinessIndex = sorted.findIndex((p) => p.track === 'business')

      if (firstBusinessIndex !== -1) {
        expect(lastClinicalIndex).toBeLessThan(firstBusinessIndex)
      }
    })
  })

  describe('getTrainingProgramsByTrack', () => {
    it('returns only clinical programs', () => {
      const clinical = getTrainingProgramsByTrack('clinical')
      expect(clinical.every((p) => p.track === 'clinical')).toBe(true)
    })

    it('returns only business programs', () => {
      const business = getTrainingProgramsByTrack('business')
      expect(business.every((p) => p.track === 'business')).toBe(true)
    })
  })

  describe('getCertificationPrograms', () => {
    it('returns only programs with certifications', () => {
      const certPrograms = getCertificationPrograms()
      expect(certPrograms.every((p) => p.grants.certification)).toBe(true)
    })

    it('includes major certification programs', () => {
      const certPrograms = getCertificationPrograms()
      const certTypes = certPrograms.map((p) => p.grants.certification)
      expect(certTypes).toContain('trauma_certified')
      expect(certTypes).toContain('couples_certified')
      expect(certTypes).toContain('cbt_certified')
    })
  })

  describe('getSkillPrograms', () => {
    it('returns programs with skill bonus but no certification', () => {
      const skillPrograms = getSkillPrograms()
      expect(skillPrograms.every((p) => p.grants.skillBonus && !p.grants.certification)).toBe(true)
    })
  })

  describe('getProgramForCertification', () => {
    it('finds program for trauma certification', () => {
      const program = getProgramForCertification('trauma_certified')
      expect(program?.id).toBe('trauma_training')
    })

    it('returns undefined for invalid certification', () => {
      // @ts-expect-error Testing invalid input
      const program = getProgramForCertification('nonexistent_certified')
      expect(program).toBeUndefined()
    })
  })

  describe('formatTrainingDuration', () => {
    it('formats short durations in hours', () => {
      expect(formatTrainingDuration(4)).toBe('4 hours')
    })

    it('formats long durations in days', () => {
      expect(formatTrainingDuration(24)).toBe('3 days (24h)')
      expect(formatTrainingDuration(8)).toBe('1 day (8h)')
    })
  })
})

describe('Random Events', () => {
  describe('RANDOM_EVENTS', () => {
    it('has positive events', () => {
      expect(RANDOM_EVENTS.referral_call).toBeDefined()
      expect(RANDOM_EVENTS.positive_review).toBeDefined()
      expect(RANDOM_EVENTS.networking_opportunity).toBeDefined()
    })

    it('has negative events', () => {
      expect(RANDOM_EVENTS.therapist_sick).toBeDefined()
      expect(RANDOM_EVENTS.insurance_audit).toBeDefined()
      expect(RANDOM_EVENTS.economic_downturn).toBeDefined()
    })

    it('has neutral events', () => {
      expect(RANDOM_EVENTS.difficult_session).toBeDefined()
      expect(RANDOM_EVENTS.scheduling_conflict).toBeDefined()
    })

    it('each event has required properties', () => {
      for (const event of Object.values(RANDOM_EVENTS)) {
        expect(event.id).toBeDefined()
        expect(event.title).toBeDefined()
        expect(event.description).toBeDefined()
        expect(['positive', 'negative', 'neutral']).toContain(event.type)
        expect(event.cooldownDays).toBeGreaterThan(0)
        expect(event.choices.length).toBeGreaterThanOrEqual(2)

        // Each choice should have text and effects
        for (const choice of event.choices) {
          expect(choice.text).toBeDefined()
          expect(choice.effects).toBeDefined()
        }
      }
    })

    it('events with conditions have valid condition types', () => {
      for (const event of Object.values(RANDOM_EVENTS)) {
        if (event.conditions) {
          if (event.conditions.minReputation !== undefined) {
            expect(event.conditions.minReputation).toBeGreaterThanOrEqual(0)
          }
          if (event.conditions.minTherapists !== undefined) {
            expect(event.conditions.minTherapists).toBeGreaterThan(0)
          }
          if (event.conditions.minDay !== undefined) {
            expect(event.conditions.minDay).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  describe('getRandomEvent', () => {
    it('returns event by id', () => {
      const event = getRandomEvent('referral_call')
      expect(event?.title).toBe('Colleague Referral')
    })

    it('returns undefined for invalid id', () => {
      expect(getRandomEvent('nonexistent')).toBeUndefined()
    })
  })

  describe('getAllRandomEvents', () => {
    it('returns all events as array', () => {
      const events = getAllRandomEvents()
      expect(events.length).toBe(Object.keys(RANDOM_EVENTS).length)
      expect(events.length).toBeGreaterThan(10) // Should have many events
    })
  })

  describe('getRandomEventsByType', () => {
    it('returns only positive events', () => {
      const positive = getRandomEventsByType('positive')
      expect(positive.every((e) => e.type === 'positive')).toBe(true)
      expect(positive.length).toBeGreaterThan(0)
    })

    it('returns only negative events', () => {
      const negative = getRandomEventsByType('negative')
      expect(negative.every((e) => e.type === 'negative')).toBe(true)
      expect(negative.length).toBeGreaterThan(0)
    })

    it('returns only neutral events', () => {
      const neutral = getRandomEventsByType('neutral')
      expect(neutral.every((e) => e.type === 'neutral')).toBe(true)
      expect(neutral.length).toBeGreaterThan(0)
    })
  })

  describe('getEligibleRandomEvents', () => {
    it('returns events meeting reputation requirement', () => {
      const eligible = getEligibleRandomEvents(50, 150, 2)
      // Should include events requiring up to 150 reputation
      expect(eligible.some((e) => e.conditions?.minReputation === 100)).toBe(true)
      // Should not include events requiring more than 150
      expect(eligible.every((e) => !e.conditions?.minReputation || e.conditions.minReputation <= 150)).toBe(true)
    })

    it('returns events meeting therapist requirement', () => {
      const eligible = getEligibleRandomEvents(50, 100, 1)
      // Should not include events requiring 2+ therapists
      expect(eligible.every((e) => !e.conditions?.minTherapists || e.conditions.minTherapists <= 1)).toBe(true)
    })

    it('returns events meeting day requirement', () => {
      const eligible = getEligibleRandomEvents(10, 100, 2)
      // Should not include events with minDay > 10
      expect(eligible.every((e) => !e.conditions?.minDay || e.conditions.minDay <= 10)).toBe(true)
    })
  })

  describe('COMMON_MODIFIERS', () => {
    it('has common modifier templates', () => {
      expect(COMMON_MODIFIERS.busy_week).toBeDefined()
      expect(COMMON_MODIFIERS.reputation_boost).toBeDefined()
      // CRIT-003 fix: renamed from economic_downturn to reduced_rates to avoid ID collision
      expect(COMMON_MODIFIERS.reduced_rates).toBeDefined()
    })

    it('modifiers have valid properties', () => {
      for (const modifier of Object.values(COMMON_MODIFIERS)) {
        expect(modifier.id).toBeDefined()
        expect(modifier.name).toBeDefined()
        expect(modifier.effect).toBeDefined()
        expect(modifier.duration).toBeGreaterThan(0)
        expect(modifier.multiplier).toBeGreaterThan(0)
      }
    })
  })

  describe('createModifierInstance', () => {
    it('creates modifier with start day', () => {
      const modifier = createModifierInstance('busy_week', 15)
      expect(modifier?.startDay).toBe(15)
      expect(modifier?.duration).toBe(COMMON_MODIFIERS.busy_week.duration)
    })

    it('returns null for invalid modifier', () => {
      expect(createModifierInstance('nonexistent', 10)).toBeNull()
    })
  })
})

describe('Decision Events', () => {
  describe('DECISION_EVENTS', () => {
    it('has general events (no conditions)', () => {
      expect(DECISION_EVENTS.client_resistant).toBeDefined()
      expect(DECISION_EVENTS.emotional_breakthrough).toBeDefined()
      expect(DECISION_EVENTS.boundary_issue).toBeDefined()
    })

    it('has condition-specific events', () => {
      expect(DECISION_EVENTS.anxiety_spiral).toBeDefined()
      expect(DECISION_EVENTS.depressive_hopelessness).toBeDefined()
      expect(DECISION_EVENTS.trauma_flashback).toBeDefined()
    })

    it('each event has required properties', () => {
      for (const event of Object.values(DECISION_EVENTS)) {
        expect(event.id).toBeDefined()
        expect(event.title).toBeDefined()
        expect(event.description).toBeDefined()
        expect(event.choices.length).toBeGreaterThanOrEqual(2)

        // Each choice should have text and effects
        for (const choice of event.choices) {
          expect(choice.text).toBeDefined()
          expect(choice.effects).toBeDefined()
        }
      }
    })

    it('events with trigger conditions have valid types', () => {
      for (const event of Object.values(DECISION_EVENTS)) {
        if (event.triggerConditions) {
          if (event.triggerConditions.minSeverity !== undefined) {
            expect(event.triggerConditions.minSeverity).toBeGreaterThan(0)
            expect(event.triggerConditions.minSeverity).toBeLessThanOrEqual(10)
          }
          if (event.triggerConditions.conditionCategories !== undefined) {
            expect(event.triggerConditions.conditionCategories.length).toBeGreaterThan(0)
          }
        }
      }
    })

    it('choices have quality effects within valid range', () => {
      for (const event of Object.values(DECISION_EVENTS)) {
        for (const choice of event.choices) {
          if (choice.effects.quality !== undefined) {
            expect(choice.effects.quality).toBeGreaterThanOrEqual(-0.5)
            expect(choice.effects.quality).toBeLessThanOrEqual(0.5)
          }
        }
      }
    })
  })

  describe('getDecisionEvent', () => {
    it('returns event by id', () => {
      const event = getDecisionEvent('client_resistant')
      expect(event?.title).toBe('Client Resistance')
    })

    it('returns undefined for invalid id', () => {
      expect(getDecisionEvent('nonexistent')).toBeUndefined()
    })
  })

  describe('getAllDecisionEvents', () => {
    it('returns all events as array', () => {
      const events = getAllDecisionEvents()
      expect(events.length).toBe(Object.keys(DECISION_EVENTS).length)
      expect(events.length).toBeGreaterThan(10) // Should have many events
    })
  })

  describe('getEligibleDecisionEvents', () => {
    it('returns all general events regardless of severity', () => {
      const eligible = getEligibleDecisionEvents(1, 'anxiety')
      const generalEvents = getGeneralDecisionEvents()
      // All general events should be eligible
      for (const general of generalEvents) {
        expect(eligible.some((e) => e.id === general.id)).toBe(true)
      }
    })

    it('filters by severity requirement', () => {
      const lowSeverity = getEligibleDecisionEvents(3, 'anxiety')
      const highSeverity = getEligibleDecisionEvents(8, 'anxiety')

      // High severity should have more eligible events
      expect(highSeverity.length).toBeGreaterThanOrEqual(lowSeverity.length)
    })

    it('filters by condition category', () => {
      const anxietyEvents = getEligibleDecisionEvents(5, 'anxiety')
      const depressionEvents = getEligibleDecisionEvents(5, 'depression')

      // Should include anxiety-specific event
      expect(anxietyEvents.some((e) => e.id === 'anxiety_spiral')).toBe(true)
      expect(depressionEvents.some((e) => e.id === 'anxiety_spiral')).toBe(false)

      // Should include depression-specific event
      expect(depressionEvents.some((e) => e.id === 'depressive_hopelessness')).toBe(true)
      expect(anxietyEvents.some((e) => e.id === 'depressive_hopelessness')).toBe(false)
    })
  })

  describe('getGeneralDecisionEvents', () => {
    it('returns only events without trigger conditions', () => {
      const general = getGeneralDecisionEvents()
      expect(general.every((e) => !e.triggerConditions)).toBe(true)
      expect(general.length).toBeGreaterThan(0)
    })
  })

  describe('getDecisionEventsForCondition', () => {
    it('returns events for anxiety', () => {
      const events = getDecisionEventsForCondition('anxiety')
      expect(events.some((e) => e.id === 'anxiety_spiral')).toBe(true)
    })

    it('returns events for trauma', () => {
      const events = getDecisionEventsForCondition('trauma')
      expect(events.some((e) => e.id === 'trauma_flashback')).toBe(true)
    })

    it('returns events for depression', () => {
      const events = getDecisionEventsForCondition('depression')
      expect(events.some((e) => e.id === 'depressive_hopelessness')).toBe(true)
    })
  })

  describe('getAverageOptimalQualityGain', () => {
    it('returns a positive number', () => {
      const avg = getAverageOptimalQualityGain()
      expect(avg).toBeGreaterThan(0)
    })

    it('returns a reasonable quality gain (< 0.2)', () => {
      const avg = getAverageOptimalQualityGain()
      expect(avg).toBeLessThan(0.2)
    })
  })
})
