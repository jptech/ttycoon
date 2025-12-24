import { useCallback, useMemo, useRef } from 'react'
import { Modal, Button } from '@/components/ui'
import { useGameStore } from '@/store'
import { getPracticeLevelFromReputation } from '@/core/types'
import styles from './CheatModal.module.css'

export interface CheatModalProps {
  open: boolean
  onClose: () => void
}

export function CheatModal({ open, onClose }: CheatModalProps) {
  const { balance, reputation } = useGameStore()
  const practiceLevel = useMemo(() => getPracticeLevelFromReputation(reputation), [reputation])

  const setBalance = useGameStore((s) => s.setBalance)
  const setReputation = useGameStore((s) => s.setReputation)

  const balanceRef = useRef<HTMLInputElement | null>(null)
  const reputationRef = useRef<HTMLInputElement | null>(null)

  const handleApply = useCallback(() => {
    const nextBalance = Number(balanceRef.current?.value)
    const nextReputation = Number(reputationRef.current?.value)

    if (!Number.isFinite(nextBalance) || !Number.isFinite(nextReputation)) {
      return
    }

    setBalance(nextBalance, 'cheat_set_balance')
    setReputation(nextReputation, 'cheat_set_reputation')
    onClose()
  }, [setBalance, setReputation, onClose])

  return (
    <Modal open={open} onClose={onClose} title="Cheats" size="md">
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Economy</h3>
          <p className={styles.hint}>Directly set debugging values (saved into game state).</p>

          <div className={styles.row}>
            <label className={styles.label} htmlFor="cheat-balance">
              Balance
            </label>
            <input
              id="cheat-balance"
              className={styles.input}
              inputMode="numeric"
              defaultValue={String(balance)}
              ref={balanceRef}
              aria-label="Balance"
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Reputation</h3>
          <p className={styles.hint}>Sets reputation and recalculates practice level automatically.</p>

          <div className={styles.row}>
            <label className={styles.label} htmlFor="cheat-reputation">
              Reputation (0-500)
            </label>
            <input
              id="cheat-reputation"
              className={styles.input}
              inputMode="numeric"
              defaultValue={String(reputation)}
              ref={reputationRef}
              aria-label="Reputation"
            />
            <div className={styles.readonly}>Current level: {practiceLevel}</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </Modal>
  )
}
