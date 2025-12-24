import { forwardRef, type HTMLAttributes } from 'react'
import { cn, clamp } from '@/lib/utils'

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Progress value from 0 to 100 */
  value: number
  /** Optional max value (default 100) */
  max?: number
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show percentage label */
  showLabel?: boolean
  /** Animate the progress */
  animated?: boolean
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      showLabel = false,
      animated = true,
      ...props
    },
    ref
  ) => {
    const percentage = clamp((value / max) * 100, 0, 100)

    const variants = {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-error',
      info: 'bg-info',
    }

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    }

    return (
      <div className={cn('w-full', className)} {...props}>
        <div
          ref={ref}
          className={cn('w-full bg-muted rounded-full overflow-hidden', sizes[size])}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn(
              'h-full rounded-full',
              variants[variant],
              animated && 'transition-all duration-300 ease-out'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1 text-xs text-muted-foreground text-right">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    )
  }
)

ProgressBar.displayName = 'ProgressBar'
