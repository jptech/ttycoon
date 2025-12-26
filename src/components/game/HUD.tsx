import { Settings, HelpCircle, Star, Activity } from 'lucide-react'
import { formatMoney, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { SpeedControls } from './SpeedControls'
import { getReputationDisplay } from '@/core/reputation'

export interface ActiveSessionInfo {
  /** Session id */
  sessionId: string
  /** Therapist name for the session */
  therapistName: string
  /** Client name for the current session */
  clientName: string
  /** Session progress (0-1) */
  progress: number
  /** Session duration in minutes */
  durationMinutes: number
  /** Whether session is virtual */
  isVirtual?: boolean
  /** Whether this session involves the player therapist */
  isPlayer?: boolean
}

export interface HUDProps {
  /** Current day number */
  day: number
  /** Current hour (0-23) */
  hour: number
  /** Current minute (0-59) */
  minute: number
  /** Current game speed */
  speed: 0 | 1 | 2 | 3
  /** Whether game is paused */
  isPaused: boolean
  /** Current balance */
  balance: number
  /** Current reputation */
  reputation: number
  /** Practice level */
  practiceLevel: number
  /** Active sessions currently in progress */
  activeSessions?: ActiveSessionInfo[]
  /** Speed change callback */
  onSpeedChange: (speed: 0 | 1 | 2 | 3) => void
  /** Skip callback */
  onSkip?: () => void
  /** Whether skip should be enabled */
  skipEnabled?: boolean
  /** Settings click callback */
  onSettingsClick?: () => void
  /** Help click callback */
  onHelpClick?: () => void
  /** Reputation details callback */
  onReputationClick?: () => void
}

export function HUD({
  day,
  hour,
  minute,
  speed,
  isPaused,
  balance,
  reputation,
  activeSessions,
  onSpeedChange,
  onSkip,
  skipEnabled,
  onSettingsClick,
  onHelpClick,
  onReputationClick,
}: HUDProps) {
  const sessionsInProgress = activeSessions?.filter((s) => s.progress < 1) ?? []
  const hasActiveSessions = sessionsInProgress.length > 0

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-2.5 gap-6">
        {/* Left: Day/Time Block */}
        <div className="flex items-center gap-5">
          {/* Day & Time - unified block */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Day</span>
              <span className="font-display text-xl font-bold tabular-nums">{day}</span>
            </div>
            <span className="text-lg tabular-nums">{formatTime(hour, minute)}</span>
          </div>

          {/* Status indicator - minimal */}
          {hasActiveSessions ? (
            <div className="flex items-center gap-2 text-primary">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium tabular-nums">
                {sessionsInProgress.length} active
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No sessions</span>
          )}
        </div>

        {/* Center: Speed Controls */}
        <SpeedControls
          speed={speed}
          isPaused={isPaused}
          onSpeedChange={onSpeedChange}
          onSkip={onSkip}
          skipEnabled={skipEnabled}
        />

        {/* Right: Resources & Actions */}
        <div className="flex items-center gap-5">
          {/* Balance - clean, prominent */}
          <span className="text-lg font-semibold tabular-nums">{formatMoney(balance)}</span>

          {/* Reputation - compact */}
          <ReputationDisplay reputation={reputation} onClick={onReputationClick} />

          {/* Utility buttons */}
          <div className="flex items-center gap-1 ml-2">
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
                aria-label="Settings"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            )}
            {onHelpClick && (
              <button
                onClick={onHelpClick}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-ring"
                aria-label="Help"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * Compact reputation display for HUD
 */
function ReputationDisplay({ reputation, onClick }: { reputation: number; onClick?: () => void }) {
  const display = getReputationDisplay(reputation)

  const content = (
    <div className="flex items-center gap-2">
      <Star className="w-4 h-4 fill-reputation text-reputation" />
      <span className="font-semibold tabular-nums">{Math.floor(display.current)}</span>
      <Badge variant="reputation" size="sm" className="text-xs px-1.5">
        L{display.level}
      </Badge>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center rounded-lg px-2.5 py-1.5 -mx-2.5 -my-1.5',
          'transition-all duration-150',
          'hover:bg-reputation/10 focus-ring'
        )}
        title={`${display.levelName} - ${Math.floor(display.progressToNext)}/${display.nextLevelThreshold ? display.nextLevelThreshold - display.minForLevel : 'Max'}`}
      >
        {content}
      </button>
    )
  }

  return content
}
