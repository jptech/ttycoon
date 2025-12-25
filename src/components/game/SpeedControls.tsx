import { Play, Pause, FastForward, ChevronsRight, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const buttonBase = 'p-2 rounded-md transition-colors'
  const activeStyle = 'bg-primary text-primary-foreground'
  const inactiveStyle = 'hover:bg-muted-foreground/10'

  return (
    <div className={cn('flex items-center gap-1 bg-muted rounded-lg p-1', className)}>
      {/* Pause */}
      <button
        onClick={() => onSpeedChange(0)}
        className={cn(buttonBase, isPaused ? activeStyle : inactiveStyle)}
        aria-label="Pause"
        title="Pause (0x)"
      >
        <Pause className="w-4 h-4" />
      </button>

      {/* 1x Speed */}
      <button
        onClick={() => onSpeedChange(1)}
        className={cn(buttonBase, !isPaused && speed === 1 ? activeStyle : inactiveStyle)}
        aria-label="Normal speed"
        title="Normal (1x)"
      >
        <Play className="w-4 h-4" />
      </button>

      {/* 2x Speed */}
      <button
        onClick={() => onSpeedChange(2)}
        className={cn(buttonBase, !isPaused && speed === 2 ? activeStyle : inactiveStyle)}
        aria-label="Fast speed"
        title="Fast (2x)"
      >
        <FastForward className="w-4 h-4" />
      </button>

      {/* 3x Speed */}
      <button
        onClick={() => onSpeedChange(3)}
        className={cn(buttonBase, !isPaused && speed === 3 ? activeStyle : inactiveStyle)}
        aria-label="Fastest speed"
        title="Fastest (3x)"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>

      {/* Skip separator and button */}
      {onSkip && (
        <>
          <div className="w-px h-6 bg-border mx-1" />
          <button
            onClick={onSkip}
            disabled={!skipEnabled}
            className={cn(
              buttonBase,
              'disabled:opacity-50 disabled:cursor-not-allowed',
              inactiveStyle
            )}
            aria-label="Skip"
            title="Skip to next session (or next day)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}
