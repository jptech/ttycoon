import { forwardRef, type HTMLAttributes, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the modal is open */
  open: boolean
  /** Callback when the modal should close */
  onClose: () => void
  /** Modal title */
  title?: string
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Whether to show the close button */
  showCloseButton?: boolean
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdropClick?: boolean
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean
  /** Use display font for title */
  displayTitle?: boolean
  /** Show decorative accent header */
  accentHeader?: boolean
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      open,
      onClose,
      title,
      size = 'md',
      showCloseButton = true,
      closeOnBackdropClick = true,
      closeOnEscape = true,
      displayTitle = false,
      accentHeader = false,
      children,
      ...props
    },
    ref
  ) => {
    // Handle escape key
    useEffect(() => {
      if (!open || !closeOnEscape) return

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }

      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [open, closeOnEscape, onClose])

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    }, [open])

    const handleBackdropClick = useCallback(
      (e: React.MouseEvent) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose()
        }
      },
      [closeOnBackdropClick, onClose]
    )

    const sizeStyles: Record<typeof size, string> = {
      sm: '384px',
      md: '448px',
      lg: '512px',
      xl: '576px',
    }

    if (!open) return null

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Backdrop with blur */}
        <div
          data-testid="modal-backdrop"
          className="absolute inset-0 modal-backdrop animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        />

        {/* Modal content */}
        <div
          ref={ref}
          data-testid="modal-content"
          className={cn(
            'relative w-full bg-card rounded-xl shadow-lg border border-border',
            'max-h-[calc(100vh-2rem)] flex flex-col',
            'modal-enter',
            className
          )}
          style={{ maxWidth: sizeStyles[size] }}
          {...props}
        >
          {/* Accent header decoration */}
          {accentHeader && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent rounded-t-xl" />
          )}

          {/* Header */}
          {(title || showCloseButton) && (
            <div
              className={cn(
                'flex items-center justify-between p-4 border-b border-border-subtle',
                accentHeader && 'pt-5',
                accentHeader && 'bg-gradient-to-b from-surface-elevated/50 to-transparent'
              )}
            >
              {title && (
                <h2
                  id="modal-title"
                  className={cn(
                    'text-lg font-semibold',
                    displayTitle && 'font-display text-xl'
                  )}
                >
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors ml-auto focus-ring"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-4 overflow-y-auto" data-testid="modal-body">
            {children}
          </div>
        </div>
      </div>,
      document.body
    )
  }
)

Modal.displayName = 'Modal'

export type ModalFooterProps = HTMLAttributes<HTMLDivElement>

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2 pt-4 border-t border-border-subtle',
        '-mx-4 -mb-4 px-4 py-3 bg-surface-elevated/30 rounded-b-xl',
        className
      )}
      {...props}
    />
  )
)

ModalFooter.displayName = 'ModalFooter'
