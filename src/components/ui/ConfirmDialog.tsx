import { Modal, ModalFooter } from './Modal'
import { Button } from './Button'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog should close */
  onClose: () => void
  /** Callback when the user confirms */
  onConfirm: () => void
  /** Dialog title */
  title: string
  /** Dialog message/description */
  message: string
  /** Confirm button text */
  confirmText?: string
  /** Cancel button text */
  cancelText?: string
  /** Dialog variant - affects icon and button color */
  variant?: 'default' | 'warning' | 'danger'
  /** Additional details to show (e.g., cost breakdown) */
  details?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  details,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const Icon = variant === 'danger' ? AlertCircle : variant === 'warning' ? AlertTriangle : Info

  const iconColorClass = {
    default: 'text-primary',
    warning: 'text-warning',
    danger: 'text-error',
  }[variant]

  const buttonVariant = {
    default: 'primary' as const,
    warning: 'warning' as const,
    danger: 'danger' as const,
  }[variant]

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" closeOnBackdropClick={false}>
      <div className="flex gap-4">
        <div className={cn('shrink-0 mt-0.5', iconColorClass)}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-3">
          <p className="text-foreground">{message}</p>
          {details && <div className="text-sm text-muted-foreground">{details}</div>}
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={buttonVariant} onClick={handleConfirm}>
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
