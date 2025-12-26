import { useState, useCallback, useRef, useEffect } from 'react'
import { Button, Modal, Badge } from '@/components/ui'
import { useUIStore } from '@/store'
import type { Therapist, CredentialType, TherapeuticModality } from '@/core/types'
import { CREDENTIAL_CONFIG, MODALITY_CONFIG } from '@/core/therapists/TherapistManager'
import { generateId, cn } from '@/lib/utils'
import { GraduationCap, Brain, Check } from 'lucide-react'
import styles from './NewGameModal.module.css'

const STARTER_CREDENTIALS: CredentialType[] = ['LPC', 'LMFT', 'LCSW']
const STARTER_MODALITIES: TherapeuticModality[] = ['Integrative', 'CBT', 'Humanistic', 'Psychodynamic']

// Helper to format condition category names
const formatCondition = (condition: string) => {
  return condition.charAt(0).toUpperCase() + condition.slice(1)
}

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

  // HIGH-004 fix: Track tutorial timeout for cleanup
  const tutorialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tutorialTimeoutRef.current) {
        clearTimeout(tutorialTimeoutRef.current)
      }
    }
  }, [])

  // Trait selections (1-10 scale, default 5)
  const [warmth, setWarmth] = useState(5)
  const [analytical, setAnalytical] = useState(5)
  const [creativity, setCreativity] = useState(5)

  // Professional identity
  const [credential, setCredential] = useState<CredentialType>('LPC')
  const [modality, setModality] = useState<TherapeuticModality>('Integrative')

  const handleContinue = useCallback(() => {
    if (step === 'practice') {
      setStep('therapist')
    } else {
      // Create the player therapist
      const playerTherapist: Therapist = {
        id: generateId(),
        displayName: therapistName,
        isPlayer: true,
        credential,
        primaryModality: modality,
        secondaryModalities: [],
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
        // HIGH-004 fix: Store timeout ref for cleanup
        // Small delay to let the game initialize
        tutorialTimeoutRef.current = setTimeout(() => {
          startTutorial()
        }, 500)
      }
    }
  }, [step, practiceName, therapistName, warmth, analytical, creativity, credential, modality, onStartGame, showTutorial, startTutorial])

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

            {/* Professional Background - Credential Selection */}
            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">License Type</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_CREDENTIALS.map((cred) => {
                    const config = CREDENTIAL_CONFIG[cred]
                    const isSelected = credential === cred
                    return (
                      <button
                        key={cred}
                        type="button"
                        onClick={() => setCredential(cred)}
                        className={cn(
                          'relative flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                          'hover:border-primary/50 hover:bg-primary/5',
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border bg-surface'
                        )}
                      >
                        <div className={cn(
                          'flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{config.abbreviation}</span>
                            <span className="text-sm text-muted-foreground">-</span>
                            <span className="text-sm text-muted-foreground truncate">{config.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {config.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modality Selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Therapeutic Approach</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STARTER_MODALITIES.map((mod) => {
                    const config = MODALITY_CONFIG[mod]
                    const isSelected = modality === mod
                    const strongMatches = config.strongMatch || []
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setModality(mod)}
                        className={cn(
                          'relative flex flex-col p-3 rounded-lg border text-left transition-all',
                          'hover:border-accent/50 hover:bg-accent/5',
                          isSelected
                            ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                            : 'border-border bg-surface'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-foreground text-sm">{config.name}</span>
                          <div className={cn(
                            'flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                            isSelected ? 'border-accent bg-accent' : 'border-muted-foreground/40'
                          )}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {config.description}
                        </p>
                        {strongMatches.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {strongMatches.map((match) => (
                              <Badge key={match} variant="outline" size="sm" className="text-[10px] px-1.5 py-0">
                                {formatCondition(match)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {strongMatches.length === 0 && (
                          <Badge variant="default" size="sm" className="text-[10px] px-1.5 py-0 mt-2 w-fit">
                            All conditions
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Your approach affects session quality bonuses for matching conditions.
                </p>
              </div>
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
