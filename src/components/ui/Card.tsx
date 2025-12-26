import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated' | 'accent' | 'warm' | 'interactive'
  hasAccentHeader?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hasAccentHeader = false, ...props }, ref) => {
    const variants = {
      default: 'bg-card border border-border',
      outlined: 'bg-transparent border-2 border-border',
      elevated: 'bg-surface-elevated shadow-md border border-border-subtle',
      accent: 'bg-card border border-primary/30 shadow-glow-primary',
      warm: 'bg-gradient-to-br from-surface to-surface-hover border border-border',
      interactive: 'bg-card border border-border card-interactive cursor-pointer',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl p-4 relative',
          variants[variant],
          hasAccentHeader && 'card-accent-header overflow-hidden pt-5',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4', className)} {...props} />
  )
)

CardHeader.displayName = 'CardHeader'

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  useDisplayFont?: boolean
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, useDisplayFont = false, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-semibold text-lg',
        useDisplayFont && 'font-display',
        className
      )}
      {...props}
    />
  )
)

CardTitle.displayName = 'CardTitle'

export type CardContentProps = HTMLAttributes<HTMLDivElement>

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
)

CardContent.displayName = 'CardContent'

export type CardFooterProps = HTMLAttributes<HTMLDivElement>

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 flex items-center gap-2', className)} {...props} />
  )
)

CardFooter.displayName = 'CardFooter'
