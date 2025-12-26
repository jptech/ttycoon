import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center font-medium
      transition-all duration-150 ease-out
      focus-ring rounded-lg
      disabled:opacity-50 disabled:pointer-events-none
      active:scale-[0.98]
    `

    const variants = {
      primary: `
        bg-primary text-primary-foreground
        hover:bg-primary-hover
        shadow-sm hover:shadow-md hover:shadow-primary/20
      `,
      secondary: `
        bg-secondary text-secondary-foreground
        border border-border
        hover:bg-surface-hover hover:border-border
      `,
      ghost: `
        hover:bg-surface-hover text-foreground
        active:bg-surface
      `,
      danger: `
        bg-error text-white
        hover:bg-error/90
        shadow-sm hover:shadow-md hover:shadow-error/20
      `,
      warning: `
        bg-warning text-warning-foreground
        hover:bg-warning/90
        shadow-sm hover:shadow-md hover:shadow-warning/20
      `,
      accent: `
        bg-accent text-accent-foreground
        hover:bg-accent-hover
        shadow-sm hover:shadow-md hover:shadow-accent/20
      `,
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
