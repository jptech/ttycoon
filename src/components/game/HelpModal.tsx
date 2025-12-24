import { Modal, Button } from '@/components/ui'
import styles from './HelpModal.module.css'

export interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Help" size="lg">
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Getting Started</h3>
          <p className={styles.text}>
            Welcome to Therapy Tycoon! Your goal is to build a successful mental health practice
            by treating clients, hiring therapists, and growing your reputation.
          </p>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Core Mechanics</h3>
          <ul className={styles.list}>
            <li>
              <strong>Clients</strong> - New clients arrive on your waiting list. Schedule them
              with available therapists to start treatment.
            </li>
            <li>
              <strong>Sessions</strong> - Sessions run in real-time. Decision events may occur
              during sessions that affect quality and outcomes.
            </li>
            <li>
              <strong>Therapists</strong> - Manage energy levels to prevent burnout. Train them
              to unlock certifications and specializations.
            </li>
            <li>
              <strong>Money</strong> - Earn from completed sessions. Insurance clients pay less
              but provide steady income.
            </li>
            <li>
              <strong>Reputation</strong> - Grow your reputation to attract more clients and
              unlock new opportunities.
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Speed Controls</h3>
          <ul className={styles.list}>
            <li>
              <strong>Pause (||)</strong> - Stop time to make decisions
            </li>
            <li>
              <strong>1x, 2x, 3x</strong> - Control game speed
            </li>
            <li>
              <strong>Skip ({">>"})</strong> - Jump to next scheduled session
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tabs</h3>
          <ul className={styles.list}>
            <li>
              <strong>Schedule</strong> - View and manage your weekly calendar
            </li>
            <li>
              <strong>Clients</strong> - See waiting clients and book sessions
            </li>
            <li>
              <strong>Team</strong> - Manage your therapists and hire new ones
            </li>
            <li>
              <strong>Finances</strong> - Track income, expenses, and pending claims
            </li>
            <li>
              <strong>Office</strong> - Upgrade your building and unlock telehealth
            </li>
            <li>
              <strong>Insurance</strong> - Apply to insurance panels for more clients
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tips</h3>
          <ul className={styles.list}>
            <li>Watch therapist energy - tired therapists produce lower quality sessions</li>
            <li>Match therapist specializations to client conditions for better outcomes</li>
            <li>Balance private pay and insurance clients for stable income</li>
            <li>Upgrade your office to unlock more therapy rooms</li>
          </ul>
        </div>
      </div>

      <div className={styles.footer}>
        <Button variant="primary" onClick={onClose}>
          Got it!
        </Button>
      </div>
    </Modal>
  )
}
