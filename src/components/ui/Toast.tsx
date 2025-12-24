import { forwardRef, type HTMLAttributes, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Award } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'achievement'

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** Toast type determines icon and colors */
  type?: ToastType
  /** Toast title */
  title: string
  /** Optional message */
  message?: string
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number
  /** Callback when toast should be dismissed */
  onDismiss?: () => void
  /** Show dismiss button */
  dismissible?: boolean
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  achievement: Award,
}

const styles = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-error/10 border-error/30 text-error',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-info/10 border-info/30 text-info',
  achievement: 'bg-accent/10 border-accent/30 text-accent',
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      type = 'info',
      title,
      message,
      duration = 5000,
      onDismiss,
      dismissible = true,
      ...props
    },
    ref
  ) => {
    const [isExiting, setIsExiting] = useState(false)
    const Icon = icons[type]

    useEffect(() => {
      if (duration === 0 || !onDismiss) return

      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(onDismiss, 150) // Wait for exit animation
      }, duration)

      return () => clearTimeout(timer)
    }, [duration, onDismiss])

    const handleDismiss = () => {
      if (!onDismiss) return
      setIsExiting(true)
      setTimeout(onDismiss, 150)
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
          'animate-in slide-in-from-right duration-200',
          isExiting && 'animate-out fade-out slide-out-to-right duration-150',
          styles[type],
          className
        )}
        {...props}
      >
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{title}</div>
          {message && <div className="text-sm opacity-90 mt-0.5">{message}</div>}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={handleDismiss}
            className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
)

Toast.displayName = 'Toast'

export interface ToastContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Position of the toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export const ToastContainer = forwardRef<HTMLDivElement, ToastContainerProps>(
  ({ className, position = 'bottom-right', children, ...props }, ref) => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col gap-2 pointer-events-none',
          positions[position],
          className
        )}
        style={{ maxWidth: 'calc(100vw - 32px)', width: '384px' }}
        {...props}
      >
        <div className="flex flex-col gap-2 pointer-events-auto">{children}</div>
      </div>
    )
  }
)

ToastContainer.displayName = 'ToastContainer'
