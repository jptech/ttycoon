import { Settings, HelpCircle, User, Coffee } from 'lucide-react'
import { formatMoney, formatTime } from '@/lib/utils'
import { Badge, ProgressBar } from '@/components/ui'
import { SpeedControls } from './SpeedControls'

export interface ActiveSessionInfo {
  /** Client name for the current session */
  clientName: string
  /** Session progress (0-1) */
  progress: number
  /** Session duration in minutes */
  durationMinutes: number
  /** Whether session is virtual */
  isVirtual?: boolean
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
  /** Active session info (if player is in a session) */
  activeSession?: ActiveSessionInfo | null
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
  practiceLevel,
  activeSession,
  onSpeedChange,
  onSkip,
  skipEnabled,
  onSettingsClick,
  onHelpClick,
}: HUDProps) {
  const speedLabel = isPaused ? 'Paused' : `${speed}x`

  // Calculate remaining time for active session
  const getSessionTimeRemaining = () => {
    if (!activeSession) return ''
    const elapsed = Math.floor(activeSession.progress * activeSession.durationMinutes)
    const remaining = activeSession.durationMinutes - elapsed
    return `${remaining}m left`
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Time */}
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold">Day {day}</div>
          <div className="text-muted-foreground">{formatTime(hour, minute)}</div>
          <Badge variant={isPaused ? 'warning' : 'success'} size="sm">
            {speedLabel}
          </Badge>

          {/* Session/Break Status Indicator */}
          <div className="w-px h-6 bg-border" />
          {activeSession ? (
            <div className="flex items-center gap-3 bg-info/10 border border-info/30 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-info" />
                <span className="font-medium text-info">In Session</span>
              </div>
              <div className="w-px h-4 bg-info/30" />
              <div className="flex flex-col gap-0.5 min-w-[140px]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{activeSession.clientName}</span>
                  <span className="text-muted-foreground text-xs">{getSessionTimeRemaining()}</span>
                </div>
                <ProgressBar
                  value={activeSession.progress * 100}
                  max={100}
                  size="sm"
                  variant="info"
                  className="h-1.5"
                />
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
        <SpeedControls
          speed={speed}
          isPaused={isPaused}
          onSpeedChange={onSpeedChange}
          onSkip={onSkip}
          skipEnabled={skipEnabled}
        />

        {/* Right: Resources & Menu */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-semibold text-lg">{formatMoney(balance)}</div>
            <div className="text-xs text-muted-foreground">Balance</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg flex items-center gap-1">
              <span className="text-accent">★</span> {reputation}
            </div>
            <div className="text-xs text-muted-foreground">Level {practiceLevel}</div>
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
