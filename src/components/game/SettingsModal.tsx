import { useCallback, useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useGameStore } from '@/store'
import { useUIStore } from '@/store'
import { SaveManager } from '@/core/engine'
import styles from './SettingsModal.module.css'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onNewGame: () => void
}

export function SettingsModal({ open, onClose, onNewGame }: SettingsModalProps) {
  const { gameSpeed, showSessionSummaryModal, showDaySummaryModal, autoApplyDecisions, rememberedDecisions } = useGameStore()
  const setGameSpeed = useGameStore((state) => state.setGameSpeed)
  const setShowSessionSummaryModal = useGameStore((state) => state.setShowSessionSummaryModal)
  const setShowDaySummaryModal = useGameStore((state) => state.setShowDaySummaryModal)
  const setAutoApplyDecisions = useGameStore((state) => state.setAutoApplyDecisions)
  const openModal = useUIStore((s) => s.openModal)
  const [confirmNewGame, setConfirmNewGame] = useState(false)

  const hasRememberedDecisions = Object.keys(rememberedDecisions).length > 0

  const handleSave = useCallback(() => {
    SaveManager.save()
  }, [])

  const handleSpeedChange = useCallback(
    (speed: 1 | 2 | 3) => {
      setGameSpeed(speed)
    },
    [setGameSpeed]
  )

  const handleNewGame = useCallback(() => {
    if (!confirmNewGame) {
      setConfirmNewGame(true)
      return
    }
    // Clear save and trigger new game
    SaveManager.deleteSave()
    onClose()
    onNewGame()
    setConfirmNewGame(false)
  }, [confirmNewGame, onClose, onNewGame])

  const handleClose = useCallback(() => {
    setConfirmNewGame(false)
    onClose()
  }, [onClose])

  const handleOpenCheats = useCallback(() => {
    openModal('cheats')
  }, [openModal])

  return (
    <Modal open={open} onClose={handleClose} title="Settings" size="md">
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Game Speed</h3>
          <p className={styles.hint}>Default speed when game is unpaused</p>
          <div className={styles.speedButtons}>
            {[1, 2, 3].map((speed) => (
              <button
                key={speed}
                className={`${styles.speedButton} ${gameSpeed === speed ? styles.active : ''}`}
                onClick={() => handleSpeedChange(speed as 1 | 2 | 3)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Session Summary</h3>
          <p className={styles.hint}>Show detailed modal after each session completes</p>
          <div className={styles.toggleButtons}>
            <button
              className={`${styles.toggleButton} ${showSessionSummaryModal ? styles.active : styles.activeOff}`}
              onClick={() => setShowSessionSummaryModal(true)}
            >
              On
            </button>
            <button
              className={`${styles.toggleButton} ${!showSessionSummaryModal ? styles.active : styles.activeOff}`}
              onClick={() => setShowSessionSummaryModal(false)}
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Day Summary</h3>
          <p className={styles.hint}>Show end-of-day summary at 5 PM</p>
          <div className={styles.toggleButtons}>
            <button
              className={`${styles.toggleButton} ${showDaySummaryModal ? styles.active : styles.activeOff}`}
              onClick={() => setShowDaySummaryModal(true)}
            >
              On
            </button>
            <button
              className={`${styles.toggleButton} ${!showDaySummaryModal ? styles.active : styles.activeOff}`}
              onClick={() => setShowDaySummaryModal(false)}
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Auto-Apply Decisions</h3>
          <p className={styles.hint}>Automatically repeat previous choices in familiar situations</p>
          <div className={styles.toggleButtons}>
            <button
              className={`${styles.toggleButton} ${autoApplyDecisions ? styles.active : styles.activeOff}`}
              onClick={() => setAutoApplyDecisions(true)}
              disabled={!hasRememberedDecisions}
            >
              On
            </button>
            <button
              className={`${styles.toggleButton} ${!autoApplyDecisions ? styles.active : styles.activeOff}`}
              onClick={() => setAutoApplyDecisions(false)}
              disabled={!hasRememberedDecisions}
            >
              Off
            </button>
          </div>
          {!hasRememberedDecisions && (
            <p className={styles.disabledHint}>Make decisions during sessions to enable this feature</p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Save Game</h3>
          <p className={styles.hint}>Game auto-saves every minute</p>
          <Button variant="secondary" onClick={handleSave}>
            Save Now
          </Button>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>New Game</h3>
          <p className={styles.hint}>Start a fresh game. Current progress will be lost.</p>
          <Button
            variant={confirmNewGame ? 'danger' : 'secondary'}
            onClick={handleNewGame}
          >
            {confirmNewGame ? 'Click again to confirm' : 'New Game'}
          </Button>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Debug</h3>
          <p className={styles.hint}>Tools to speed up testing and balancing.</p>
          <Button variant="secondary" onClick={handleOpenCheats}>
            Cheats
          </Button>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>About</h3>
          <p className={styles.hint}>
            Therapy Tycoon - Build and manage your mental health practice.
          </p>
          <p className={styles.version}>Version 1.0.0</p>
        </div>
      </div>

      <div className={styles.footer}>
        <Button variant="primary" onClick={handleClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
