import { useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Award, Check, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, type InboxNotification, type NotificationPriority } from '@/store/uiStore'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  achievement: Award,
}

const styles = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  achievement: 'text-accent',
}

/**
 * Format timestamp relative to now
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Group notifications by day
 */
function groupByDay(notifications: InboxNotification[]): Map<string, InboxNotification[]> {
  const groups = new Map<string, InboxNotification[]>()

  for (const notification of notifications) {
    const date = new Date(notification.timestamp)
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const existing = groups.get(key) ?? []
    existing.push(notification)
    groups.set(key, existing)
  }

  return groups
}

interface NotificationItemProps {
  notification: InboxNotification
  onMarkRead: (id: string) => void
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const Icon = icons[notification.type]

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-colors',
        notification.isRead ? 'opacity-60' : 'bg-surface-elevated/50',
        !notification.isRead && 'hover:bg-surface-hover cursor-pointer'
      )}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
    >
      {/* Icon */}
      <div className={cn('shrink-0 mt-0.5', styles[notification.type])}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-sm', notification.isRead && 'font-normal')}>
            {notification.title}
          </span>
          {notification.priority === 'critical' && !notification.isRead && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-error/20 text-error">
              Important
            </span>
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <span className="text-[10px] text-muted-foreground mt-1 block">
          {formatRelativeTime(notification.timestamp)}
        </span>
      </div>

      {/* Read indicator */}
      {!notification.isRead && (
        <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
      )}
    </div>
  )
}

export function NotificationInbox() {
  const isOpen = useUIStore((state) => state.isInboxOpen)
  const notifications = useUIStore((state) => state.inboxNotifications)
  const unreadCount = useUIStore((state) => state.unreadCount)
  const setInboxOpen = useUIStore((state) => state.setInboxOpen)
  const markAsRead = useUIStore((state) => state.markAsRead)
  const markAllAsRead = useUIStore((state) => state.markAllAsRead)
  const clearInbox = useUIStore((state) => state.clearInbox)

  const panelRef = useRef<HTMLDivElement>(null)

  // Close on escape
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInboxOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, setInboxOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setInboxOpen(false)
      }
    }

    // Delay to avoid closing immediately on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, setInboxOpen])

  if (!isOpen) return null

  // Sort notifications by timestamp (newest first) and group by day
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp)
  const grouped = groupByDay(sortedNotifications)

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed right-4 top-16 z-50 w-80 max-h-[calc(100vh-5rem)]',
        'bg-card border border-border rounded-xl shadow-xl',
        'flex flex-col',
        'animate-in slide-in-from-right-2 duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setInboxOpen(false)}
          className="p-1 rounded hover:bg-surface-hover transition-colors"
          aria-label="Close notifications"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Actions bar */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-elevated/30">
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className={cn(
              'text-xs font-medium flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
              unreadCount > 0
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground cursor-not-allowed'
            )}
          >
            <Check className="w-3 h-3" />
            Mark all read
          </button>
          <button
            onClick={clearInbox}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-hover transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="p-2 space-y-4">
            {Array.from(grouped.entries()).map(([date, items]) => (
              <div key={date}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {date}
                </div>
                <div className="space-y-1">
                  {items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
