import { useEffect, useState } from 'react'
import { useUIStore } from '@/store'
import { TUTORIAL_STEPS, TutorialManager, type TutorialStep } from '@/core/tutorial'
import styles from './TutorialOverlay.module.css'

export interface TutorialOverlayProps {
  /** Callback when tutorial requests navigation to a tab */
  onNavigateTab?: (tab: string) => void
}

export function TutorialOverlay({ onNavigateTab }: TutorialOverlayProps) {
  const tutorialState = useUIStore((state) => state.tutorialState)
  const nextStep = useUIStore((state) => state.nextTutorialStep)
  const prevStep = useUIStore((state) => state.prevTutorialStep)
  const skipTutorial = useUIStore((state) => state.skipTutorial)

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const currentStep = TUTORIAL_STEPS[tutorialState.currentStepIndex] || null
  const isFirstStep = tutorialState.currentStepIndex === 0
  const isLastStep = tutorialState.currentStepIndex === TUTORIAL_STEPS.length - 1
  const progress = TutorialManager.getProgress(tutorialState)

  // Find and measure target element
  useEffect(() => {
    if (!tutorialState.isActive || !currentStep) return

    // Navigate to tab if specified
    if (currentStep.tab && onNavigateTab) {
      onNavigateTab(currentStep.tab)
    }

    // Wait for DOM to update after tab navigation
    const timer = setTimeout(() => {
      if (currentStep.targetSelector) {
        const element = document.querySelector(currentStep.targetSelector)
        if (element) {
          const rect = element.getBoundingClientRect()
          setTargetRect(rect)
        } else {
          setTargetRect(null)
        }
      } else {
        setTargetRect(null)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [tutorialState.isActive, currentStep, onNavigateTab])

  // Handle keyboard navigation
  useEffect(() => {
    if (!tutorialState.isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          nextStep()
          break
        case 'ArrowLeft':
          if (!isFirstStep) prevStep()
          break
        case 'Escape':
          skipTutorial()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tutorialState.isActive, isFirstStep, nextStep, prevStep, skipTutorial])

  if (!tutorialState.isActive || !currentStep) {
    return null
  }

  const isCentered = currentStep.position === 'center' || !targetRect

  return (
    <div className={styles.overlay}>
      {/* Spotlight cutout effect */}
      {targetRect && (
        <div
          className={styles.spotlight}
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={`${styles.tooltip} ${isCentered ? styles.centered : ''}`}
        style={
          isCentered
            ? undefined
            : getTooltipPosition(targetRect, currentStep.position)
        }
      >
        <div className={styles.header}>
          <span className={styles.stepIndicator}>
            Step {tutorialState.currentStepIndex + 1} of {TUTORIAL_STEPS.length}
          </span>
          <button
            className={styles.skipButton}
            onClick={skipTutorial}
            aria-label="Skip tutorial"
          >
            Skip
          </button>
        </div>

        <h3 className={styles.title}>{currentStep.title}</h3>
        <p className={styles.content}>{currentStep.content}</p>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={styles.navigation}>
          <button
            className={styles.navButton}
            onClick={prevStep}
            disabled={isFirstStep}
          >
            Previous
          </button>
          <button
            className={`${styles.navButton} ${styles.primaryButton}`}
            onClick={nextStep}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Calculate tooltip position based on target element and desired position
 */
function getTooltipPosition(
  rect: DOMRect | null,
  position: TutorialStep['position']
): React.CSSProperties | undefined {
  if (!rect) return undefined

  const tooltipWidth = 360
  const tooltipHeight = 200
  const offset = 16

  switch (position) {
    case 'top':
      return {
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
        bottom: window.innerHeight - rect.top + offset,
      }
    case 'bottom':
      return {
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
        top: rect.bottom + offset,
      }
    case 'left':
      return {
        right: window.innerWidth - rect.left + offset,
        top: Math.max(16, rect.top + rect.height / 2 - tooltipHeight / 2),
      }
    case 'right':
      return {
        left: rect.right + offset,
        top: Math.max(16, rect.top + rect.height / 2 - tooltipHeight / 2),
      }
    default:
      return undefined
  }
}
