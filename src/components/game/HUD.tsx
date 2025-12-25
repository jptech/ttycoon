import { Settings, HelpCircle, User, Coffee } from 'lucide-react'
import { formatMoney, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Badge, ProgressBar } from '@/components/ui'
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
}: HUDProps) {
  const speedLabel = isPaused ? 'Paused' : `${speed}x`

  const sessionsInProgress = activeSessions?.filter((s) => s.progress < 1) ?? []

  const getSessionTimeRemaining = (session: ActiveSessionInfo) => {
    const elapsed = Math.floor(session.progress * session.durationMinutes)
    const remaining = session.durationMinutes - elapsed
    return `${remaining}m left`
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
      <div className="grid grid-cols-3 items-center px-4 py-2">
        {/* Left: Time */}
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold min-w-[70px] tabular-nums">Day {day}</div>
          <div className="text-muted-foreground min-w-[90px] tabular-nums">{formatTime(hour, minute)}</div>
          <Badge 
            variant={isPaused ? 'warning' : 'success'} 
            size="sm"
            className="w-[64px] justify-center"
          >
            {speedLabel}
          </Badge>

          {/* Session/Break Status Indicator */}
          <div className="w-px h-6 bg-border" />
          {sessionsInProgress.length > 0 ? (
            <div className="flex items-center gap-3 bg-info/10 border border-info/30 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-info" />
                <span className="font-medium text-info">Sessions</span>
                <Badge variant="info" size="sm">
                  {sessionsInProgress.length}
                </Badge>
              </div>
              <div className="w-px h-4 bg-info/30" />
              <div className="flex flex-col gap-2 min-w-[220px]">
                {sessionsInProgress.slice(0, 2).map((s) => (
                  <div key={s.sessionId} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn('text-foreground truncate', s.isPlayer && 'font-semibold')}>
                        {s.therapistName}: {s.clientName}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{getSessionTimeRemaining(s)}</span>
                    </div>
                    <ProgressBar
                      value={s.progress * 100}
                      max={100}
                      size="sm"
                      variant={s.isPlayer ? 'info' : 'default'}
                      className="h-1.5"
                    />
                  </div>
                ))}
                {sessionsInProgress.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{sessionsInProgress.length - 2} more</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coffee className="w-4 h-4" />
              <span className="text-sm">Available</span>
            </div>
          )}
        </div>

        {/* Center: Speed Controls */}
        <div className="flex justify-center">
          <SpeedControls
            speed={speed}
            isPaused={isPaused}
            onSpeedChange={onSpeedChange}
            onSkip={onSkip}
            skipEnabled={skipEnabled}
          />
        </div>

        {/* Right: Resources & Menu */}
        <div className="flex items-center justify-end gap-4">
          <div className="text-right min-w-[100px]">
            <div className="font-semibold text-lg tabular-nums">{formatMoney(balance)}</div>
            <div className="text-xs text-muted-foreground">Balance</div>
          </div>
          <div className="min-w-[160px]">
            <ReputationDisplay reputation={reputation} />
          </div>
          <div className="w-px h-8 bg-border" />
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          {onHelpClick && (
            <button
              onClick={onHelpClick}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Reputation display component for HUD
 */
function ReputationDisplay({ reputation }: { reputation: number }) {
  const display = getReputationDisplay(reputation)
  const progressText = display.nextLevelThreshold
    ? `${Math.floor(display.progressToNext)}/${display.nextLevelThreshold - display.minForLevel}`
    : 'Max'

  return (
    <div className="text-right">
      <div className="font-semibold text-lg flex items-center justify-end gap-1.5 tabular-nums">
        <span className="text-accent">★</span>
        <span>{Math.floor(display.current)}</span>
        <span className="text-xs px-1 py-0.5 bg-accent/10 rounded text-accent font-medium">
          L{display.level}
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {progressText}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{display.levelName}</div>
    </div>
  )
}
