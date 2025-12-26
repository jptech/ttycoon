import { Play, Pause, FastForward, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Triple forward icon for 3x speed - outlined style matching Lucide icons */
function TripleForward({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="1,5 8,12 1,19" />
      <polygon points="9,5 16,12 9,19" />
      <polygon points="17,5 24,12 17,19" />
    </svg>
  )
}

export interface SpeedControlsProps {
  /** Current game speed (0-3) */
  speed: 0 | 1 | 2 | 3
  /** Whether the game is currently paused */
  isPaused: boolean
  /** Callback when speed changes */
  onSpeedChange: (speed: 0 | 1 | 2 | 3) => void
  /** Callback when skip button is pressed */
  onSkip?: () => void
  /** Whether skip is enabled */
  skipEnabled?: boolean
  /** Optional class name */
  className?: string
}

export function SpeedControls({
  speed,
  isPaused,
  onSpeedChange,
  onSkip,
  skipEnabled = true,
  className,
}: SpeedControlsProps) {
  const buttonBase = cn(
    'relative p-2 rounded-lg transition-all duration-150',
    'focus-ring'
  )
  const activeStyle = 'bg-primary/15 text-primary'
  const inactiveStyle = 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {/* Pause */}
      <button
        onClick={() => onSpeedChange(0)}
        className={cn(buttonBase, isPaused ? activeStyle : inactiveStyle)}
        aria-label="Pause"
        title="Pause"
      >
        <Pause className="w-4 h-4" />
      </button>

      {/* 1x Speed */}
      <button
        onClick={() => onSpeedChange(1)}
        className={cn(buttonBase, !isPaused && speed === 1 ? activeStyle : inactiveStyle)}
        aria-label="Normal speed"
        title="Normal speed"
      >
        <Play className="w-4 h-4" />
      </button>

      {/* 2x Speed */}
      <button
        onClick={() => onSpeedChange(2)}
        className={cn(buttonBase, !isPaused && speed === 2 ? activeStyle : inactiveStyle)}
        aria-label="Fast speed"
        title="Fast"
      >
        <FastForward className="w-4 h-4" />
      </button>

      {/* 3x Speed */}
      <button
        onClick={() => onSpeedChange(3)}
        className={cn(buttonBase, !isPaused && speed === 3 ? activeStyle : inactiveStyle)}
        aria-label="Fastest speed"
        title="Fastest"
      >
        <TripleForward className="w-4 h-4" />
      </button>

      {/* Skip button */}
      {onSkip && (
        <button
          onClick={onSkip}
          disabled={!skipEnabled}
          className={cn(
            buttonBase,
            'ml-1 disabled:opacity-40 disabled:cursor-not-allowed',
            inactiveStyle
          )}
          aria-label="Skip"
          title="Skip to next event"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
