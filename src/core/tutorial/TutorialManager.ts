import { TUTORIAL_STEPS, getTutorialStep, type TutorialStep } from './tutorialSteps'

/**
 * Tutorial state interface
 */
export interface TutorialState {
  /** Whether tutorial is currently active */
  isActive: boolean
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Whether user has completed the tutorial */
  hasSeenTutorial: boolean
}

/**
 * Initial tutorial state
 */
export const INITIAL_TUTORIAL_STATE: TutorialState = {
  isActive: false,
  currentStepIndex: 0,
  hasSeenTutorial: false,
}

/**
 * Pure functions for managing tutorial state
 */
export const TutorialManager = {
  /**
   * Get the current tutorial step
   */
  getCurrentStep(state: TutorialState): TutorialStep | null {
    if (!state.isActive) return null
    return getTutorialStep(state.currentStepIndex)
  },

  /**
   * Check if there's a next step available
   */
  hasNextStep(state: TutorialState): boolean {
    return state.currentStepIndex < TUTORIAL_STEPS.length - 1
  },

  /**
   * Check if there's a previous step available
   */
  hasPreviousStep(state: TutorialState): boolean {
    return state.currentStepIndex > 0
  },

  /**
   * Get the total number of steps
   */
  getTotalSteps(): number {
    return TUTORIAL_STEPS.length
  },

  /**
   * Get progress as a percentage (0-100)
   */
  getProgress(state: TutorialState): number {
    if (!state.isActive) return 0
    return Math.round((state.currentStepIndex / (TUTORIAL_STEPS.length - 1)) * 100)
  },

  /**
   * Check if current step is the last step
   */
  isLastStep(state: TutorialState): boolean {
    return state.currentStepIndex === TUTORIAL_STEPS.length - 1
  },

  /**
   * Check if current step is the first step
   */
  isFirstStep(state: TutorialState): boolean {
    return state.currentStepIndex === 0
  },
}
