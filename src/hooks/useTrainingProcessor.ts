import { useEffect, useRef, useCallback } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { EventBus, GameEvents } from '@/core/events'
import { TrainingProcessor, type CompletedTraining } from '@/core/training'
import { TRAINING_PROGRAMS } from '@/data/trainingPrograms'

interface UseTrainingProcessorOptions {
  /** Whether training processing is enabled */
  enabled?: boolean
  /** Called when a training is completed */
  onTrainingCompleted?: (completed: CompletedTraining) => void
}

/**
 * Hook to manage daily training progression.
 * Subscribes to DAY_STARTED and progresses all active trainings by 8 hours.
 */
export function useTrainingProcessor(options: UseTrainingProcessorOptions = {}) {
  const { enabled = true, onTrainingCompleted } = options

  const updateTherapist = useGameStore((state) => state.updateTherapist)
  const removeActiveTraining = useGameStore((state) => state.removeActiveTraining)
  const updateActiveTraining = useGameStore((state) => state.updateActiveTraining)
  const addReputation = useGameStore((state) => state.addReputation)
  const setInsuranceMultiplier = useGameStore((state) => state.setInsuranceMultiplier)
  const addHiringCapacityBonus = useGameStore((state) => state.addHiringCapacityBonus)
  const insuranceMultiplier = useGameStore((state) => state.insuranceMultiplier)
  const addNotification = useUIStore((state) => state.addNotification)

  // Store callbacks in ref to avoid recreation
  const callbacksRef = useRef({ onTrainingCompleted })
  useEffect(() => {
    callbacksRef.current = { onTrainingCompleted }
  })

  // Track last processed day to avoid duplicate processing
  const lastProcessedDayRef = useRef(0)

  /**
   * Apply clinic bonus from business training
   */
  const applyClinicBonus = useCallback((bonus: { type: string; value: number }) => {
    switch (bonus.type) {
      case 'reputation_bonus':
        addReputation(bonus.value, 'Business Training')
        addNotification({
          type: 'info',
          title: 'Reputation Bonus',
          message: `+${bonus.value} reputation from training`,
        })
        break
      case 'insurance_multiplier':
        // Add to current multiplier (e.g., 1.0 + 0.1 = 1.1x)
        const newMultiplier = insuranceMultiplier + bonus.value
        setInsuranceMultiplier(newMultiplier)
        addNotification({
          type: 'success',
          title: 'Insurance Bonus',
          message: `Insurance payments increased to ${Math.round(newMultiplier * 100)}%`,
        })
        break
      case 'hiring_capacity':
        addHiringCapacityBonus(bonus.value)
        addNotification({
          type: 'success',
          title: 'Hiring Capacity',
          message: `Can now hire ${bonus.value} more therapist(s)`,
        })
        break
    }
  }, [addReputation, addNotification, insuranceMultiplier, setInsuranceMultiplier, addHiringCapacityBonus])

  /**
   * Process all active trainings for the day
   */
  const processTrainings = useCallback(() => {
    const state = useGameStore.getState()
    const { activeTrainings, therapists } = state

    if (activeTrainings.length === 0) return

    const result = TrainingProcessor.processDailyTraining(
      activeTrainings,
      therapists,
      TRAINING_PROGRAMS
    )

    // Update remaining active trainings
    for (const training of result.updatedTrainings) {
      updateActiveTraining(training.therapistId, training.programId, {
        hoursCompleted: training.hoursCompleted,
      })

      // Emit progress event
      EventBus.emit(GameEvents.TRAINING_PROGRESS, {
        therapistId: training.therapistId,
        programId: training.programId,
        progress: TrainingProcessor.getTrainingProgress(training),
      })
    }

    // Process completed trainings
    for (const completed of result.completedTrainings) {
      // Update therapist with new skills/certifications
      const updates = result.therapistUpdates.get(completed.therapistId)
      if (updates) {
        updateTherapist(completed.therapistId, updates)
      }

      // Remove from active trainings
      removeActiveTraining(completed.therapistId, completed.program.id)

      // Apply clinic bonuses (business training effects)
      if (completed.clinicBonus) {
        applyClinicBonus(completed.clinicBonus)
      }

      // Emit completion events
      EventBus.emit(GameEvents.TRAINING_COMPLETED, {
        therapistId: completed.therapistId,
        programId: completed.program.id,
      })

      for (const cert of completed.certificationsGained) {
        EventBus.emit(GameEvents.CERTIFICATION_EARNED, {
          therapistId: completed.therapistId,
          certification: cert,
        })
      }

      // Show notification
      const message = completed.certificationsGained.length > 0
        ? `${completed.therapistName} earned ${formatCertification(completed.certificationsGained[0])}!`
        : `${completed.therapistName} completed ${completed.programName}`

      addNotification({
        type: 'success',
        title: 'Training Complete',
        message,
      })

      // Call optional callback
      callbacksRef.current.onTrainingCompleted?.(completed)
    }
  }, [updateTherapist, removeActiveTraining, updateActiveTraining, addNotification, applyClinicBonus])

  /**
   * Handle day start - process all trainings
   */
  const handleDayStart = useCallback(
    (data: { dayNumber: number }) => {
      // Prevent duplicate processing
      if (data.dayNumber <= lastProcessedDayRef.current) return
      lastProcessedDayRef.current = data.dayNumber

      processTrainings()
    },
    [processTrainings]
  )

  // Subscribe to DAY_STARTED events
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = EventBus.on(GameEvents.DAY_STARTED, handleDayStart)

    return unsubscribe
  }, [enabled, handleDayStart])

  /**
   * Start training for a therapist
   */
  const startTraining = useCallback((therapistId: string, programId: string): boolean => {
    const state = useGameStore.getState()
    const { therapists, activeTrainings, balance, currentDay } = state
    const { addActiveTraining, removeMoney, updateTherapist: storeUpdateTherapist } = useGameStore.getState()

    const therapist = therapists.find((t) => t.id === therapistId)
    const program = TRAINING_PROGRAMS[programId]

    if (!therapist || !program) return false

    // Validate
    const canStart = TrainingProcessor.canStartTraining(
      therapist,
      program,
      activeTrainings,
      balance
    )

    if (!canStart.canStart) {
      addNotification({
        type: 'error',
        title: 'Cannot Start Training',
        message: canStart.reason || 'Unknown error',
      })
      return false
    }

    // Deduct cost
    const success = removeMoney(program.cost, `Training: ${program.name}`)
    if (!success) return false

    // Update therapist status
    storeUpdateTherapist(therapistId, { status: 'in_training' })

    // Add active training
    addActiveTraining({
      programId: program.id,
      therapistId,
      startDay: currentDay,
      hoursCompleted: 0,
      totalHours: program.durationHours,
    })

    addNotification({
      type: 'success',
      title: 'Training Started',
      message: `${therapist.displayName} enrolled in ${program.name}`,
    })

    return true
  }, [addNotification])

  /**
   * Get training statistics
   */
  const getTrainingStats = useCallback(() => {
    const state = useGameStore.getState()
    const { activeTrainings, currentDay } = state

    return {
      activeCount: activeTrainings.length,
      trainings: activeTrainings.map((t) => ({
        ...t,
        progress: TrainingProcessor.getTrainingProgress(t),
        daysRemaining: TrainingProcessor.getDaysRemaining(t),
        estimatedCompletion: TrainingProcessor.getEstimatedCompletionDay(t, currentDay),
      })),
    }
  }, [])

  return {
    startTraining,
    processTrainings,
    getTrainingStats,
  }
}

/**
 * Format certification for display
 */
function formatCertification(cert: string): string {
  return cert
    .replace(/_/g, ' ')
    .replace(/certified/i, 'Certification')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
