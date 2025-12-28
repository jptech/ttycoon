import { useCallback, useState, useMemo } from 'react'
import { Modal, Button, Badge } from '@/components/ui'
import { useGameStore } from '@/store'
import { useUIStore } from '@/store'
import { TherapistManager, MAX_BREAKS_PER_DAY } from '@/core/therapists'
import type { TherapistWorkSchedule } from '@/core/types'
import { Clock, Calendar, AlertTriangle, Coffee, Zap } from 'lucide-react'
import styles from './TherapistScheduleModal.module.css'

export interface TherapistScheduleModalProps {
  open: boolean
  onClose: () => void
  therapistId: string
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM to 10 PM

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:00 ${ampm}`
}

export function TherapistScheduleModal({
  open,
  onClose,
  therapistId,
}: TherapistScheduleModalProps) {
  const therapist = useGameStore((state) =>
    state.therapists.find((t) => t.id === therapistId)
  )
  const sessions = useGameStore((state) => state.sessions)
  const schedule = useGameStore((state) => state.schedule)
  const currentDay = useGameStore((state) => state.currentDay)
  const updateTherapistWorkSchedule = useGameStore(
    (state) => state.updateTherapistWorkSchedule
  )
  const addNotification = useUIStore((state) => state.addNotification)

  // Local state for editing
  const currentSchedule = useMemo(
    () => (therapist ? TherapistManager.getWorkSchedule(therapist) : null),
    [therapist]
  )
  const [startHour, setStartHour] = useState(currentSchedule?.workStartHour ?? 8)
  const [endHour, setEndHour] = useState(currentSchedule?.workEndHour ?? 17)
  const [breakHours, setBreakHours] = useState<number[]>(
    currentSchedule?.breakHours ?? []
  )
  const [error, setError] = useState<string | null>(null)

  // Reset state when therapist changes
  useMemo(() => {
    if (currentSchedule) {
      setStartHour(currentSchedule.workStartHour)
      setEndHour(currentSchedule.workEndHour)
      setBreakHours(currentSchedule.breakHours)
      setError(null)
    }
  }, [currentSchedule])

  // Toggle a break hour on/off
  const toggleBreakHour = useCallback((hour: number) => {
    setBreakHours((prev) => {
      if (prev.includes(hour)) {
        return prev.filter((h) => h !== hour)
      }
      if (prev.length >= MAX_BREAKS_PER_DAY) {
        return prev // Can't add more
      }
      return [...prev, hour].sort((a, b) => a - b)
    })
  }, [])

  // Energy forecast
  const energyForecast = useMemo(() => {
    if (!therapist) return null
    return TherapistManager.forecastEnergy(therapist, sessions, schedule, currentDay)
  }, [therapist, sessions, schedule, currentDay])

  // Calculate working hours
  const workingHours = useMemo(() => {
    const total = endHour - startHour
    return total - breakHours.length
  }, [startHour, endHour, breakHours])

  // Validate before save
  const validateAndSave = useCallback(() => {
    const newSchedule: TherapistWorkSchedule = {
      workStartHour: startHour,
      workEndHour: endHour,
      breakHours,
    }

    const validation = TherapistManager.validateWorkSchedule(newSchedule)
    if (!validation.valid) {
      setError(validation.reason || 'Invalid schedule')
      return
    }

    const result = updateTherapistWorkSchedule(therapistId, newSchedule)
    if (!result.success) {
      setError(result.reason || 'Failed to update schedule')
      return
    }

    addNotification({
      type: 'success',
      title: 'Schedule Updated',
      message: 'Work schedule updated successfully',
    })
    onClose()
  }, [
    startHour,
    endHour,
    breakHours,
    therapistId,
    updateTherapistWorkSchedule,
    addNotification,
    onClose,
  ])

  if (!therapist) {
    return null
  }

  return (
    <Modal open={open} onClose={onClose} title="Work Schedule" size="md">
      <div className={styles.content}>
        {/* Therapist Info */}
        <div className={styles.header}>
          <span className={styles.therapistName}>{therapist.displayName}</span>
          <Badge variant="default" size="sm">
            {therapist.isPlayer ? 'You' : 'Staff'}
          </Badge>
        </div>

        {/* Energy Forecast */}
        {energyForecast && (
          <div
            className={`${styles.forecast} ${
              energyForecast.willBurnOut ? styles.forecastWarning : ''
            }`}
          >
            <div className={styles.forecastHeader}>
              <Zap className="w-4 h-4" />
              <span>Today's Forecast</span>
            </div>
            <div className={styles.forecastDetails}>
              <span>{energyForecast.scheduledSessionCount} sessions scheduled</span>
              <span className={styles.forecastEnergy}>
                ~{energyForecast.predictedEndEnergy} energy EOD
              </span>
            </div>
            {energyForecast.willBurnOut && (
              <div className={styles.burnoutWarning}>
                <AlertTriangle className="w-4 h-4" />
                <span>Risk of burnout at {formatHour(energyForecast.burnoutHour!)}</span>
              </div>
            )}
          </div>
        )}

        {/* Work Hours */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Clock className="w-4 h-4" />
            Work Hours
          </h3>
          <p className={styles.hint}>Set when this therapist is available for sessions</p>

          <div className={styles.timeSelectors}>
            <div className={styles.timeSelector}>
              <label className={styles.label}>Start</label>
              <select
                className={styles.select}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
              >
                {HOURS.filter((h) => h < endHour - 3).map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.timeSeparator}>to</div>

            <div className={styles.timeSelector}>
              <label className={styles.label}>End</label>
              <select
                className={styles.select}
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
              >
                {HOURS.filter((h) => h > startHour + 3).map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className={styles.summary}>
            <Calendar className="w-4 h-4" />
            {workingHours} hours per day
          </p>
        </div>

        {/* Breaks */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Coffee className="w-4 h-4" />
            Breaks
          </h3>
          <p className={styles.hint}>
            Select up to {MAX_BREAKS_PER_DAY} break hours (no sessions scheduled)
            {breakHours.length > 0 && ` • ${breakHours.length}/${MAX_BREAKS_PER_DAY} selected`}
          </p>

          <div className={styles.breakOptions}>
            {HOURS.filter((h) => h > startHour && h < endHour - 1).map((hour) => (
              <button
                key={hour}
                className={`${styles.breakButton} ${breakHours.includes(hour) ? styles.active : ''}`}
                onClick={() => toggleBreakHour(hour)}
                disabled={!breakHours.includes(hour) && breakHours.length >= MAX_BREAKS_PER_DAY}
              >
                {formatHour(hour)}
              </button>
            ))}
          </div>
          {breakHours.length > 0 && (
            <button
              className={styles.clearBreaks}
              onClick={() => setBreakHours([])}
            >
              Clear all breaks
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className={styles.error}>
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={validateAndSave}>
          Save Schedule
        </Button>
      </div>
    </Modal>
  )
}
