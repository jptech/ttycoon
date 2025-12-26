import { useEffect, useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Trophy, Star, Sparkles, X } from 'lucide-react'
import type { MilestoneConfig } from '@/core/types/state'

export interface AchievementToastProps {
  /** The milestone that was achieved */
  milestone: MilestoneConfig
  /** Reputation bonus awarded */
  reputationBonus: number
  /** Callback when toast should be dismissed */
  onDismiss: () => void
  /** Auto-dismiss duration in ms */
  duration?: number
}

export function AchievementToast({
  milestone,
  reputationBonus,
  onDismiss,
  duration = 6000,
}: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  // HIGH-005 fix: Track all timeouts for proper cleanup
  const exitAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (exitAnimationTimerRef.current) clearTimeout(exitAnimationTimerRef.current)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    exitAnimationTimerRef.current = setTimeout(onDismiss, 400)
  }, [onDismiss])

  // Entrance animation
  useEffect(() => {
    // Small delay for mount animation
    const showTimer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(showTimer)
  }, [])

  // Auto-dismiss
  useEffect(() => {
    if (duration === 0) return

    const timer = setTimeout(() => {
      handleDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, handleDismiss])

  return (
    <div
      className={cn(
        // Base styles
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]',
        'pointer-events-auto',
        // Entry animation
        'transition-all duration-500 ease-out',
        !isVisible && 'opacity-0 scale-75',
        isVisible && !isExiting && 'opacity-100 scale-100',
        isExiting && 'opacity-0 scale-90 transition-duration-300'
      )}
    >
      {/* Celebration background effect */}
      <div className="absolute inset-0 -z-10">
        <div
          className={cn(
            'absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/30 via-accent/10 to-transparent',
            'blur-xl transform scale-150',
            isVisible && 'animate-pulse'
          )}
        />
      </div>

      {/* Main card */}
      <div
        className={cn(
          'relative bg-card/95 backdrop-blur-lg border-2 border-accent/50 rounded-2xl',
          'shadow-2xl shadow-accent/20',
          'px-8 py-6 min-w-[320px] max-w-[400px]'
        )}
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Trophy icon with glow */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/30 rounded-full blur-lg animate-pulse" />
            <div className="relative bg-gradient-to-br from-accent to-accent/80 p-4 rounded-full">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            {/* Sparkle decorations */}
            <Sparkles
              className={cn(
                'absolute -top-2 -right-2 w-5 h-5 text-accent',
                isVisible && 'animate-bounce'
              )}
            />
            <Star
              className={cn(
                'absolute -bottom-1 -left-2 w-4 h-4 text-accent fill-accent',
                isVisible && 'animate-ping'
              )}
              style={{ animationDuration: '2s' }}
            />
          </div>
        </div>

        {/* Achievement label */}
        <div className="text-center mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Achievement Unlocked
          </span>
        </div>

        {/* Milestone name */}
        <h3 className="text-xl font-bold text-center mb-2">{milestone.name}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground text-center mb-4">
          {milestone.description}
        </p>

        {/* Reputation bonus */}
        <div className="flex items-center justify-center gap-2 bg-accent/10 rounded-lg py-2 px-4">
          <Star className="w-4 h-4 text-accent fill-accent" />
          <span className="text-sm font-medium text-accent">
            +{reputationBonus} Reputation
          </span>
        </div>

        {/* Progress bar decoration */}
        <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full bg-gradient-to-r from-accent to-accent/60 rounded-full',
              'transition-all duration-[6000ms] ease-linear',
              isVisible ? 'w-full' : 'w-0'
            )}
            style={{ transitionDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Container for displaying achievements - renders over the game
 */
export interface AchievementContainerProps {
  children?: React.ReactNode
}

export function AchievementContainer({ children }: AchievementContainerProps) {
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {children}
    </div>
  )
}
