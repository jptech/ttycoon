import { useState, useEffect } from 'react'
import { TrendingUp, Star, Sparkles } from 'lucide-react'

export interface LevelUpToastProps {
  /** Therapist name */
  therapistName: string
  /** New level achieved */
  newLevel: number
  /** Callback when toast is dismissed */
  onDismiss: () => void
  /** Auto-dismiss duration in ms (default: 5000) */
  autoDismissMs?: number
}

/**
 * Celebratory toast shown when a therapist levels up
 */
export function LevelUpToast({
  therapistName,
  newLevel,
  onDismiss,
  autoDismissMs = 5000,
}: LevelUpToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const entranceTimer = setTimeout(() => setIsVisible(true), 50)

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      handleDismiss()
    }, autoDismissMs)

    return () => {
      clearTimeout(entranceTimer)
      clearTimeout(dismissTimer)
    }
  }, [autoDismissMs])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 300) // Wait for exit animation
  }

  return (
    <div
      className={`
        fixed bottom-8 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      onClick={handleDismiss}
      role="alert"
      aria-live="polite"
    >
      <div className="relative bg-gradient-to-r from-purple-600/95 to-indigo-600/95 backdrop-blur-sm rounded-xl shadow-2xl shadow-purple-500/30 p-4 min-w-[280px] cursor-pointer border border-purple-400/30">
        {/* Sparkle decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <Sparkles
            className="absolute top-1 left-2 w-4 h-4 text-yellow-300 animate-pulse"
            style={{ animationDuration: '1s' }}
          />
          <Star
            className="absolute top-2 right-3 w-3 h-3 text-yellow-300 fill-yellow-300 animate-pulse"
            style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}
          />
          <Sparkles
            className="absolute bottom-2 right-6 w-4 h-4 text-yellow-300 animate-pulse"
            style={{ animationDuration: '1.2s', animationDelay: '0.4s' }}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30 animate-bounce">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="font-bold text-white text-lg">Level Up!</div>
            <div className="text-purple-100 text-sm">
              {therapistName} reached <span className="font-bold text-yellow-300">Level {newLevel}</span>
            </div>
          </div>

          {/* Level badge */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg font-bold text-lg text-white">
            {newLevel}
          </div>
        </div>

        {/* Skill bonus note */}
        <div className="mt-2 pt-2 border-t border-purple-400/30 text-center">
          <span className="text-xs text-purple-200">+1 Skill Bonus</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Container for level-up toast to ensure proper z-index
 */
export function LevelUpContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="pointer-events-auto">{children}</div>
    </div>
  )
}
