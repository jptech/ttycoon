import { useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PRACTICE_LEVELS, type PracticeLevelConfig } from '@/core/types'
import { getReputationDisplay } from '@/core/reputation'
import { useGameStore } from '@/store'

type LevelStatus = 'achieved' | 'current' | 'upcoming'

export interface ReputationModalProps {
  open: boolean
  onClose: () => void
}

interface LevelCard extends PracticeLevelConfig {
  status: LevelStatus
  distance: number | null
}

function formatTime(day: number, hour: number, minute: number): string {
  const paddedHour = hour.toString().padStart(2, '0')
  const paddedMinute = minute.toString().padStart(2, '0')
  return `Day ${day} • ${paddedHour}:${paddedMinute}`
}

export function ReputationModal({ open, onClose }: ReputationModalProps) {
  const reputation = useGameStore((state) => state.reputation)
  const reputationLog = useGameStore((state) => state.reputationLog)

  const display = useMemo(() => getReputationDisplay(reputation), [reputation])

  const levelCards = useMemo<LevelCard[]>(() => {
    return PRACTICE_LEVELS.map((level) => {
      const status: LevelStatus =
        level.level < display.level ? 'achieved' : level.level === display.level ? 'current' : 'upcoming'
      const distance =
        status === 'upcoming'
          ? Math.max(0, level.minReputation - Math.floor(display.current))
          : null

      return {
        ...level,
        status,
        distance,
      }
    })
  }, [display.current, display.level])

  const recentLog = reputationLog.slice(0, 20)

  return (
    <Modal open={open} onClose={onClose} title="Reputation Overview" size="lg">
      <div className="space-y-6">
        <section className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Current Reputation</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{Math.floor(display.current)}</span>
                <Badge variant="outline">Level {display.level}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{display.levelName}</p>
            </div>
            {display.nextLevelThreshold ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{display.nextLevelThreshold - Math.floor(display.current)} reputation needed</p>
                <p>Next level: {PRACTICE_LEVELS[display.level]?.name ?? 'Maxed'}</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Maximum level achieved</p>
                <p>Keep delivering great care to stay on top!</p>
              </div>
            )}
          </div>

          <ProgressBar value={display.progressPercent} />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Practice Levels</h3>
          <div className="space-y-3">
            {levelCards.map((level) => (
              <div
                key={level.level}
                className="flex items-start justify-between gap-4 border border-border rounded-lg p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">L{level.level}: {level.name}</span>
                    {level.status === 'current' && <Badge>Current</Badge>}
                    {level.status === 'achieved' && <Badge variant="secondary">Achieved</Badge>}
                    {level.status === 'upcoming' && <Badge variant="outline">Upcoming</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Requires {level.minReputation} reputation • Staff cap {level.staffCap}
                  </p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground">
                    {level.unlocks.map((unlock) => (
                      <li key={unlock}>{unlock}</li>
                    ))}
                  </ul>
                </div>
                {level.status === 'upcoming' && level.distance !== null && (
                  <div className="text-right text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{level.distance} more</p>
                    <p>to unlock</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Changes</h3>
          {recentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reputation changes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentLog.map((entry) => {
                const changeLabel = `${entry.change > 0 ? '+' : ''}${entry.change}`
                const changeColor = entry.change >= 0 ? 'text-emerald-500' : 'text-rose-500'

                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 border border-border rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-sm">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(entry.day, entry.hour, entry.minute)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className={`${changeColor} font-semibold tabular-nums`}>{changeLabel}</p>
                      <p className="text-xs text-muted-foreground">Total: {Math.floor(entry.after)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
