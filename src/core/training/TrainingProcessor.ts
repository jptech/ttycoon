import type { ActiveTraining, TrainingProgram, Therapist, Certification, ClinicBonus } from '@/core/types'
import { TherapistManager } from '@/core/therapists'

/**
 * Training system configuration
 */
export const TRAINING_CONFIG = {
  /** Training hours processed each business day */
  HOURS_PER_DAY: 8,
} as const

/**
 * Result of completing a training program
 */
export interface CompletedTraining {
  training: ActiveTraining
  program: TrainingProgram
  therapistId: string
  therapistName: string
  programName: string
  certificationsGained: Certification[]
  skillGained: number
  clinicBonus: ClinicBonus | null
}

/**
 * Result of processing daily training for all therapists
 */
export interface TrainingProgressResult {
  /** Updated training records (still in progress) */
  updatedTrainings: ActiveTraining[]
  /** Trainings that completed this cycle */
  completedTrainings: CompletedTraining[]
  /** Map of therapist IDs to their updates */
  therapistUpdates: Map<string, Partial<Therapist>>
}

/**
 * Pure functions for processing training progression
 */
export const TrainingProcessor = {
  /**
   * Process daily training progress for all active trainings.
   * Called on DAY_STARTED event to advance training by HOURS_PER_DAY.
   */
  processDailyTraining(
    activeTrainings: ActiveTraining[],
    therapists: Therapist[],
    programs: Record<string, TrainingProgram>
  ): TrainingProgressResult {
    const updatedTrainings: ActiveTraining[] = []
    const completedTrainings: CompletedTraining[] = []
    const therapistUpdates = new Map<string, Partial<Therapist>>()

    for (const training of activeTrainings) {
      const program = programs[training.programId]
      const therapist = therapists.find((t) => t.id === training.therapistId)

      if (!program || !therapist) {
        // Keep orphaned trainings (shouldn't happen)
        updatedTrainings.push(training)
        continue
      }

      // Process training hours
      const result = TherapistManager.processTraining(
        therapist,
        training,
        program,
        TRAINING_CONFIG.HOURS_PER_DAY
      )

      if (result.completed) {
        // Training is complete
        const certificationsGained: Certification[] = []
        if (program.grants.certification && !therapist.certifications.includes(program.grants.certification)) {
          certificationsGained.push(program.grants.certification)
        }

        completedTrainings.push({
          training,
          program,
          therapistId: therapist.id,
          therapistName: therapist.displayName,
          programName: program.name,
          certificationsGained,
          skillGained: program.grants.skillBonus || 0,
          clinicBonus: program.grants.clinicBonus || null,
        })

        // Store therapist updates
        therapistUpdates.set(therapist.id, {
          certifications: result.updatedTherapist.certifications,
          baseSkill: result.updatedTherapist.baseSkill,
          status: 'available',
        })
      } else {
        // Training continues
        updatedTrainings.push(result.updatedTraining)
      }
    }

    return {
      updatedTrainings,
      completedTrainings,
      therapistUpdates,
    }
  },

  /**
   * Get training progress as a percentage (0-100)
   */
  getTrainingProgress(training: ActiveTraining): number {
    if (training.totalHours === 0) return 100
    return Math.round((training.hoursCompleted / training.totalHours) * 100)
  },

  /**
   * Get estimated days remaining for a training
   */
  getDaysRemaining(training: ActiveTraining): number {
    const hoursLeft = training.totalHours - training.hoursCompleted
    if (hoursLeft <= 0) return 0
    return Math.ceil(hoursLeft / TRAINING_CONFIG.HOURS_PER_DAY)
  },

  /**
   * Get estimated completion day for a training
   */
  getEstimatedCompletionDay(training: ActiveTraining, currentDay: number): number {
    return currentDay + this.getDaysRemaining(training)
  },

  /**
   * Check if a therapist is currently in training
   */
  isTherapistInTraining(therapistId: string, activeTrainings: ActiveTraining[]): boolean {
    return activeTrainings.some((t) => t.therapistId === therapistId)
  },

  /**
   * Get active training for a specific therapist
   */
  getTherapistTraining(therapistId: string, activeTrainings: ActiveTraining[]): ActiveTraining | null {
    return activeTrainings.find((t) => t.therapistId === therapistId) || null
  },

  /**
   * Format training progress for display
   */
  formatProgress(training: ActiveTraining): string {
    const progress = this.getTrainingProgress(training)
    const daysLeft = this.getDaysRemaining(training)

    if (daysLeft === 0) {
      return 'Complete'
    }

    return `${progress}% (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)`
  },

  /**
   * Validate that a therapist can start a training program
   */
  canStartTraining(
    therapist: Therapist,
    program: TrainingProgram,
    activeTrainings: ActiveTraining[],
    currentBalance: number
  ): { canStart: boolean; reason?: string } {
    // Check if already in training
    if (this.isTherapistInTraining(therapist.id, activeTrainings)) {
      return { canStart: false, reason: 'Therapist is already in training' }
    }

    // Check balance
    if (currentBalance < program.cost) {
      return { canStart: false, reason: `Insufficient funds (need $${program.cost})` }
    }

    // Delegate to TherapistManager for prerequisite checks
    return TherapistManager.canStartTraining(therapist, program)
  },
}
