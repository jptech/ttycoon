import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'level' | 'reputation' | 'premium' | 'accent'
  size?: 'sm' | 'md'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'bg-secondary text-secondary-foreground',
      secondary: 'bg-muted text-muted-foreground',
      success: 'bg-success/15 text-success border border-success/20',
      warning: 'bg-warning/15 text-warning border border-warning/20',
      error: 'bg-error/15 text-error border border-error/20',
      info: 'bg-info/15 text-info border border-info/20',
      outline: 'bg-transparent border border-border text-foreground',
      // Game-specific variants
      level: 'bg-xp/15 text-xp border border-xp/30 font-display font-semibold shadow-glow-xp',
      reputation: 'bg-reputation/15 text-reputation border border-reputation/30 font-display font-semibold',
      premium: 'bg-gradient-to-r from-accent/20 to-primary/20 text-accent border border-accent/30',
      accent: 'bg-accent/15 text-accent border border-accent/30',
    }

    const sizes = {
      sm: 'text-xs px-1.5 py-0.5',
      md: 'text-sm px-2 py-0.5',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full transition-all duration-150',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
