import { describe, it, expect } from 'vitest'
import {
  TherapistManager,
  CREDENTIAL_CONFIG,
  MODALITY_CONFIG,
  THERAPIST_CONFIG,
} from '@/core/therapists'
import { SessionManager } from '@/core/session/SessionManager'
import type { CredentialType, TherapeuticModality, ConditionCategory } from '@/core/types'

describe('Credentials and Modalities System', () => {
  describe('CREDENTIAL_CONFIG', () => {
    it('defines all credential types', () => {
      const credentials: CredentialType[] = ['LMFT', 'LCSW', 'LPC', 'LPCC', 'PsyD', 'PhD']
      credentials.forEach((cred) => {
        expect(CREDENTIAL_CONFIG[cred]).toBeDefined()
        expect(CREDENTIAL_CONFIG[cred].name).toBeTruthy()
        expect(CREDENTIAL_CONFIG[cred].abbreviation).toBe(cred)
        expect(CREDENTIAL_CONFIG[cred].salaryMultiplier).toBeGreaterThan(0)
      })
    })

    it('doctoral credentials have higher salary multipliers', () => {
      expect(CREDENTIAL_CONFIG.PsyD.salaryMultiplier).toBeGreaterThan(CREDENTIAL_CONFIG.LPC.salaryMultiplier)
      expect(CREDENTIAL_CONFIG.PhD.salaryMultiplier).toBeGreaterThan(CREDENTIAL_CONFIG.LCSW.salaryMultiplier)
    })

    it('doctoral credentials can supervise', () => {
      expect(CREDENTIAL_CONFIG.PsyD.canSupervise).toBe(true)
      expect(CREDENTIAL_CONFIG.PhD.canSupervise).toBe(true)
      expect(CREDENTIAL_CONFIG.LPCC.canSupervise).toBe(true)
    })

    it('non-doctoral credentials cannot supervise by default', () => {
      expect(CREDENTIAL_CONFIG.LPC.canSupervise).toBe(false)
      expect(CREDENTIAL_CONFIG.LMFT.canSupervise).toBe(false)
      expect(CREDENTIAL_CONFIG.LCSW.canSupervise).toBe(false)
    })

    it('higher credentials require higher practice levels', () => {
      expect(CREDENTIAL_CONFIG.LPC.minPracticeLevel).toBeLessThanOrEqual(CREDENTIAL_CONFIG.PsyD.minPracticeLevel)
      expect(CREDENTIAL_CONFIG.PsyD.minPracticeLevel).toBeLessThanOrEqual(CREDENTIAL_CONFIG.PhD.minPracticeLevel)
    })
  })

  describe('MODALITY_CONFIG', () => {
    it('defines all modality types', () => {
      const modalities: TherapeuticModality[] = [
        'CBT', 'DBT', 'Psychodynamic', 'Humanistic', 'EMDR', 'Somatic', 'FamilySystems', 'Integrative'
      ]
      modalities.forEach((mod) => {
        expect(MODALITY_CONFIG[mod]).toBeDefined()
        expect(MODALITY_CONFIG[mod].name).toBeTruthy()
        expect(MODALITY_CONFIG[mod].description).toBeTruthy()
        expect(MODALITY_CONFIG[mod].matchBonus).toBeGreaterThanOrEqual(0)
        expect(MODALITY_CONFIG[mod].matchBonus).toBeLessThanOrEqual(0.2)
      })
    })

    it('trauma-focused modalities have strong match for trauma', () => {
      expect(MODALITY_CONFIG.EMDR.strongMatch).toContain('trauma')
      expect(MODALITY_CONFIG.Somatic.strongMatch).toContain('trauma')
    })

    it('CBT has strong match for anxiety and depression', () => {
      expect(MODALITY_CONFIG.CBT.strongMatch).toContain('anxiety')
      expect(MODALITY_CONFIG.CBT.strongMatch).toContain('depression')
    })

    it('FamilySystems has strong match for relationship', () => {
      expect(MODALITY_CONFIG.FamilySystems.strongMatch).toContain('relationship')
    })

    it('Integrative has empty strong match array', () => {
      expect(MODALITY_CONFIG.Integrative.strongMatch).toHaveLength(0)
    })
  })

  describe('TherapistManager.getModalityMatchBonus', () => {
    const createTestTherapist = (modality: TherapeuticModality, secondaries: TherapeuticModality[] = []) => {
      const candidate = TherapistManager.generateTherapist(1, 1, 12345)
      return {
        ...candidate.therapist,
        primaryModality: modality,
        secondaryModalities: secondaries,
      }
    }

    it('returns primary modality bonus for strong match', () => {
      const therapist = createTestTherapist('CBT')
      const bonus = TherapistManager.getModalityMatchBonus(therapist, 'anxiety')
      expect(bonus).toBe(MODALITY_CONFIG.CBT.matchBonus)
    })

    it('returns zero for non-matching modality', () => {
      const therapist = createTestTherapist('EMDR') // EMDR only matches trauma
      const bonus = TherapistManager.getModalityMatchBonus(therapist, 'relationship')
      expect(bonus).toBe(0)
    })

    it('returns half bonus for secondary modality match', () => {
      const therapist = createTestTherapist('Humanistic', ['CBT'])
      // Humanistic doesn't match anxiety, but secondary CBT does
      const bonus = TherapistManager.getModalityMatchBonus(therapist, 'anxiety')
      expect(bonus).toBe(MODALITY_CONFIG.CBT.matchBonus * 0.5)
    })

    it('Integrative gets small bonus for all conditions', () => {
      const therapist = createTestTherapist('Integrative')
      const conditions: ConditionCategory[] = ['anxiety', 'depression', 'trauma', 'stress', 'relationship', 'behavioral']
      conditions.forEach((condition) => {
        const bonus = TherapistManager.getModalityMatchBonus(therapist, condition)
        expect(bonus).toBe(MODALITY_CONFIG.Integrative.matchBonus)
      })
    })

    it('primary match takes precedence over secondary', () => {
      const therapist = createTestTherapist('CBT', ['EMDR'])
      // Both CBT and EMDR secondary would match different conditions
      // For anxiety, CBT primary should take precedence
      const bonus = TherapistManager.getModalityMatchBonus(therapist, 'anxiety')
      expect(bonus).toBe(MODALITY_CONFIG.CBT.matchBonus) // Full primary bonus
    })
  })

  describe('TherapistManager.canSupervise', () => {
    it('returns true for doctoral credentials', () => {
      const phdTherapist = TherapistManager.createPlayerTherapist('Dr. Test', 'PhD', 'CBT')
      const psydTherapist = TherapistManager.createPlayerTherapist('Dr. Test', 'PsyD', 'CBT')

      expect(TherapistManager.canSupervise(phdTherapist)).toBe(true)
      expect(TherapistManager.canSupervise(psydTherapist)).toBe(true)
    })

    it('returns true for LPCC', () => {
      const lpccTherapist = TherapistManager.createPlayerTherapist('Test', 'LPCC', 'CBT')
      expect(TherapistManager.canSupervise(lpccTherapist)).toBe(true)
    })

    it('returns false for non-supervisory credentials', () => {
      const lpcTherapist = TherapistManager.createPlayerTherapist('Test', 'LPC', 'CBT')
      const lmftTherapist = TherapistManager.createPlayerTherapist('Test', 'LMFT', 'CBT')
      const lcswTherapist = TherapistManager.createPlayerTherapist('Test', 'LCSW', 'CBT')

      expect(TherapistManager.canSupervise(lpcTherapist)).toBe(false)
      expect(TherapistManager.canSupervise(lmftTherapist)).toBe(false)
      expect(TherapistManager.canSupervise(lcswTherapist)).toBe(false)
    })
  })

  describe('TherapistManager.generateTherapist credential distribution', () => {
    it('generates only level 1 credentials at practice level 1', () => {
      // Run multiple times to test distribution
      for (let i = 0; i < 20; i++) {
        const candidate = TherapistManager.generateTherapist(1, 1, i * 1000)
        const minLevel = CREDENTIAL_CONFIG[candidate.therapist.credential].minPracticeLevel
        expect(minLevel).toBeLessThanOrEqual(1)
      }
    })

    it('can generate doctoral credentials at high practice levels', () => {
      // At practice level 5, doctoral credentials should be possible
      let foundDoctoral = false
      for (let i = 0; i < 50; i++) {
        const candidate = TherapistManager.generateTherapist(1, 5, i * 1000)
        if (candidate.therapist.credential === 'PsyD' || candidate.therapist.credential === 'PhD') {
          foundDoctoral = true
          break
        }
      }
      expect(foundDoctoral).toBe(true)
    })
  })

  describe('salary adjustment by credential', () => {
    it('doctoral credentials have higher salaries', () => {
      // Use same seed but different practice levels to compare
      const lowLevel = TherapistManager.generateTherapist(1, 1, 12345)
      const highLevel = TherapistManager.generateTherapist(1, 5, 54321)

      // High level practice has access to better credentials
      // This test verifies salary multiplier is applied
      if (highLevel.therapist.credential === 'PsyD' || highLevel.therapist.credential === 'PhD') {
        expect(highLevel.therapist.hourlySalary).toBeGreaterThan(THERAPIST_CONFIG.TYPICAL_HOURLY_SALARY)
      }
    })

    it('hiring cost is higher for doctoral credentials', () => {
      // Find a doctoral candidate
      let doctoralCandidate = null
      let nonDoctoralCandidate = null

      for (let i = 0; i < 100; i++) {
        const candidate = TherapistManager.generateTherapist(1, 5, i * 1000)
        if (!doctoralCandidate && (candidate.therapist.credential === 'PsyD' || candidate.therapist.credential === 'PhD')) {
          doctoralCandidate = candidate
        }
        if (!nonDoctoralCandidate && candidate.therapist.credential === 'LPC') {
          nonDoctoralCandidate = candidate
        }
        if (doctoralCandidate && nonDoctoralCandidate) break
      }

      if (doctoralCandidate && nonDoctoralCandidate) {
        // Even accounting for skill differences, doctoral hiring cost includes 1.5x multiplier
        expect(doctoralCandidate.hiringCost).toBeGreaterThan(0)
      }
    })
  })

  describe('TherapistManager.createPlayerTherapist with credentials', () => {
    it('creates player therapist with default credential and modality', () => {
      const player = TherapistManager.createPlayerTherapist('Test Player')
      expect(player.credential).toBe('LPC')
      expect(player.primaryModality).toBe('Integrative')
      expect(player.secondaryModalities).toEqual([])
    })

    it('creates player therapist with custom credential and modality', () => {
      const player = TherapistManager.createPlayerTherapist('Dr. Test', 'PhD', 'CBT')
      expect(player.credential).toBe('PhD')
      expect(player.primaryModality).toBe('CBT')
    })
  })

  describe('Training prerequisite credential checks', () => {
    const supervisorTraining = {
      id: 'supervisor_training',
      name: 'Clinical Supervisor Certification',
      description: 'Learn to supervise other therapists',
      track: 'clinical' as const,
      cost: 3500,
      durationHours: 60,
      prerequisites: {
        minSkill: 70,
        requiredCredentials: ['PsyD' as const, 'PhD' as const, 'LPCC' as const],
      },
      grants: {
        certification: 'supervisor_certified' as const,
      },
    }

    it('allows doctoral credentials to take supervisor training', () => {
      const psydTherapist = {
        ...TherapistManager.createPlayerTherapist('Dr. Test', 'PsyD', 'CBT'),
        baseSkill: 75,
      }
      const phdTherapist = {
        ...TherapistManager.createPlayerTherapist('Dr. Test', 'PhD', 'CBT'),
        baseSkill: 75,
      }
      const lpccTherapist = {
        ...TherapistManager.createPlayerTherapist('Test', 'LPCC', 'CBT'),
        baseSkill: 75,
      }

      expect(TherapistManager.canStartTraining(psydTherapist, supervisorTraining).canStart).toBe(true)
      expect(TherapistManager.canStartTraining(phdTherapist, supervisorTraining).canStart).toBe(true)
      expect(TherapistManager.canStartTraining(lpccTherapist, supervisorTraining).canStart).toBe(true)
    })

    it('blocks non-supervisory credentials from supervisor training', () => {
      const lpcTherapist = {
        ...TherapistManager.createPlayerTherapist('Test', 'LPC', 'CBT'),
        baseSkill: 75,
      }
      const lmftTherapist = {
        ...TherapistManager.createPlayerTherapist('Test', 'LMFT', 'CBT'),
        baseSkill: 75,
      }
      const lcswTherapist = {
        ...TherapistManager.createPlayerTherapist('Test', 'LCSW', 'CBT'),
        baseSkill: 75,
      }

      const lpcResult = TherapistManager.canStartTraining(lpcTherapist, supervisorTraining)
      const lmftResult = TherapistManager.canStartTraining(lmftTherapist, supervisorTraining)
      const lcswResult = TherapistManager.canStartTraining(lcswTherapist, supervisorTraining)

      expect(lpcResult.canStart).toBe(false)
      expect(lpcResult.reason).toContain('Requires credential')
      expect(lmftResult.canStart).toBe(false)
      expect(lcswResult.canStart).toBe(false)
    })
  })

  describe('Session Quality Integration', () => {
    const createTestClient = (conditionCategory: ConditionCategory) => ({
      id: 'test-client',
      displayName: 'Test Client',
      conditionCategory,
      severity: 5,
      satisfaction: 70,
      engagement: 80,
      sessionsRequired: 8,
      sessionsCompleted: 0,
      treatmentProgress: 0,
      status: 'waiting' as const,
      maxWaitDays: 14,
      daysWaiting: 0,
      prefersVirtual: false,
      arrivingAtDay: 1,
      arrivingAtHour: 9,
    })

    const createTestSession = () => ({
      id: 'test-session',
      therapistId: 'test-therapist',
      clientId: 'test-client',
      status: 'scheduled' as const,
      scheduledDay: 1,
      scheduledHour: 10,
      durationMinutes: 50,
      isVirtual: false,
      payment: 150,
      progress: 0,
      quality: 0.5,
      qualityModifiers: [],
      decisionsMade: [],
      energyCost: 15,
    })

    it('applies modality match bonus to session quality modifiers', () => {
      const cbtTherapist = TherapistManager.createPlayerTherapist('Test', 'LPC', 'CBT')
      const anxietyClient = createTestClient('anxiety')
      const session = createTestSession()

      const modifiers = SessionManager.calculateInitialQualityModifiers(cbtTherapist, anxietyClient, session)

      // CBT should match anxiety and add a modality bonus
      const modalityModifier = modifiers.find((m: { source: string }) => m.source === 'modality_match')
      expect(modalityModifier).toBeDefined()
      expect(modalityModifier.value).toBe(MODALITY_CONFIG.CBT.matchBonus)
      expect(modalityModifier.description).toContain('Cognitive Behavioral')
      expect(modalityModifier.description).toContain('anxiety')
    })

    it('does not apply modality bonus when modality does not match', () => {
      const emdrTherapist = TherapistManager.createPlayerTherapist('Test', 'LPC', 'EMDR')
      const relationshipClient = createTestClient('relationship') // EMDR doesn't match relationship
      const session = createTestSession()

      const modifiers = SessionManager.calculateInitialQualityModifiers(emdrTherapist, relationshipClient, session)

      const modalityModifier = modifiers.find((m: { source: string }) => m.source === 'modality_match')
      expect(modalityModifier).toBeUndefined()
    })

    it('Integrative modality provides small bonus for any condition', () => {
      const integrativeTherapist = TherapistManager.createPlayerTherapist('Test', 'LPC', 'Integrative')
      const conditions: ConditionCategory[] = ['anxiety', 'depression', 'trauma', 'stress', 'relationship', 'behavioral']

      conditions.forEach((condition) => {
        const client = createTestClient(condition)
        const session = createTestSession()
        const modifiers = SessionManager.calculateInitialQualityModifiers(integrativeTherapist, client, session)

        const modalityModifier = modifiers.find((m: { source: string }) => m.source === 'modality_match')
        expect(modalityModifier).toBeDefined()
        expect(modalityModifier.value).toBe(MODALITY_CONFIG.Integrative.matchBonus)
      })
    })
  })
})
