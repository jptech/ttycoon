import { useState, useCallback } from 'react'
import { Button, Modal } from '@/components/ui'
import { useUIStore } from '@/store'
import type { Therapist } from '@/core/types'
import { generateId } from '@/lib/utils'
import styles from './NewGameModal.module.css'

export interface NewGameModalProps {
  isOpen: boolean
  onStartGame: (practiceName: string, playerTherapist: Therapist) => void
}

export function NewGameModal({ isOpen, onStartGame }: NewGameModalProps) {
  const [practiceName, setPracticeName] = useState('My Therapy Practice')
  const [therapistName, setTherapistName] = useState('Dr. Smith')
  const [step, setStep] = useState<'practice' | 'therapist'>('practice')
  const [showTutorial, setShowTutorial] = useState(true)

  const startTutorial = useUIStore((state) => state.startTutorial)
  const tutorialHasBeenSeen = useUIStore((state) => state.tutorialState.hasSeenTutorial)

  // Trait selections (1-10 scale, default 5)
  const [warmth, setWarmth] = useState(5)
  const [analytical, setAnalytical] = useState(5)
  const [creativity, setCreativity] = useState(5)

  const handleContinue = useCallback(() => {
    if (step === 'practice') {
      setStep('therapist')
    } else {
      // Create the player therapist
      const playerTherapist: Therapist = {
        id: generateId(),
        displayName: therapistName,
        isPlayer: true,
        energy: 100,
        maxEnergy: 100,
        baseSkill: 50,
        level: 1,
        xp: 0,
        hourlySalary: 0, // Player doesn't have salary
        hireDay: 1,
        certifications: [],
        specializations: [],
        status: 'available',
        burnoutRecoveryProgress: 0,
        traits: {
          warmth,
          analytical,
          creativity,
        },
      }

      onStartGame(practiceName, playerTherapist)

      // Start tutorial if user chose to show it
      if (showTutorial) {
        // Small delay to let the game initialize
        setTimeout(() => {
          startTutorial()
        }, 500)
      }
    }
  }, [step, practiceName, therapistName, warmth, analytical, creativity, onStartGame, showTutorial, startTutorial])

  const handleBack = useCallback(() => {
    setStep('practice')
  }, [])

  if (!isOpen) return null

  return (
    <Modal open={isOpen} onClose={() => {}} className={styles.modal}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Therapy Tycoon</h1>
          <p className={styles.subtitle}>Build your mental health practice</p>
        </div>

        {step === 'practice' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Name Your Practice</h2>
            <input
              type="text"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              className={styles.input}
              placeholder="Enter practice name..."
              maxLength={40}
            />

            <div className={styles.previewCard}>
              <div className={styles.previewLabel}>Preview</div>
              <div className={styles.previewName}>{practiceName || 'Your Practice'}</div>
            </div>
          </div>
        )}

        {step === 'therapist' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Create Your Therapist</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Your Name</label>
              <input
                type="text"
                value={therapistName}
                onChange={(e) => setTherapistName(e.target.value)}
                className={styles.input}
                placeholder="Enter your name..."
                maxLength={30}
              />
            </div>

            <div className={styles.traitsSection}>
              <h3 className={styles.traitsTitle}>Personality Traits</h3>
              <p className={styles.traitsHint}>
                These affect your client interactions and session outcomes.
              </p>

              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Warmth</span>
                  <span className={styles.traitValue}>{warmth}</span>
                </div>
                <p className={styles.traitDescription}>
                  High warmth helps with rapport and emotional support.
                </p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={warmth}
                  onChange={(e) => setWarmth(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <div className={styles.sliderLabels}>
                  <span>Reserved</span>
                  <span>Empathetic</span>
                </div>
              </div>

              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Analytical</span>
                  <span className={styles.traitValue}>{analytical}</span>
                </div>
                <p className={styles.traitDescription}>
                  High analytical helps with CBT and structured approaches.
                </p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={analytical}
                  onChange={(e) => setAnalytical(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <div className={styles.sliderLabels}>
                  <span>Intuitive</span>
                  <span>Logical</span>
                </div>
              </div>

              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Creativity</span>
                  <span className={styles.traitValue}>{creativity}</span>
                </div>
                <p className={styles.traitDescription}>
                  High creativity helps with art therapy and unique interventions.
                </p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={creativity}
                  onChange={(e) => setCreativity(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <div className={styles.sliderLabels}>
                  <span>Traditional</span>
                  <span>Innovative</span>
                </div>
              </div>
            </div>

            {!tutorialHasBeenSeen && (
              <div className={styles.tutorialOption}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showTutorial}
                    onChange={(e) => setShowTutorial(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Show tutorial (recommended for new players)</span>
                </label>
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          {step === 'therapist' && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleContinue}
            disabled={
              (step === 'practice' && !practiceName.trim()) ||
              (step === 'therapist' && !therapistName.trim())
            }
          >
            {step === 'practice' ? 'Continue' : 'Start Game'}
          </Button>
        </div>

        <div className={styles.startingInfo}>
          <h3>You start with:</h3>
          <ul>
            <li>$5,000 starting capital</li>
            <li>Starter office suite (1 room)</li>
            <li>20 reputation</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
