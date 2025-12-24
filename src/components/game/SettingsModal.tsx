import { useCallback, useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useGameStore } from '@/store'
import { SaveManager } from '@/core/engine'
import styles from './SettingsModal.module.css'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onNewGame: () => void
}

export function SettingsModal({ open, onClose, onNewGame }: SettingsModalProps) {
  const { gameSpeed } = useGameStore()
  const setGameSpeed = useGameStore((state) => state.setGameSpeed)
  const [confirmNewGame, setConfirmNewGame] = useState(false)

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
