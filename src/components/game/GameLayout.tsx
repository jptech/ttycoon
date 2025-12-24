import { type ReactNode, useCallback, useMemo } from 'react'
import { useGameStore, useUIStore } from '@/store'
import { HUD } from './HUD'
import type { ActiveSessionInfo } from './HUD'
import { SettingsModal } from './SettingsModal'
import { HelpModal } from './HelpModal'
import { CheatModal } from './CheatModal'
import { ToastContainer, Toast } from '@/components/ui'

export interface GameLayoutProps {
  /** Main game content */
  children: ReactNode
  /** Side panel content */
  sidePanel?: ReactNode
  /** Speed change handler */
  onSpeedChange: (speed: 0 | 1 | 2 | 3) => void
  /** Skip to next session handler */
  onSkip?: () => void
  /** New game handler */
  onNewGame?: () => void
}

export function GameLayout({ children, sidePanel, onSpeedChange, onSkip, onNewGame }: GameLayoutProps) {
  const { currentDay, currentHour, currentMinute, balance, reputation, practiceLevel, gameSpeed, isPaused, therapists, sessions } =
    useGameStore()
  const { openModal, closeModal, activeModal } = useUIStore()
  const notifications = useUIStore((state) => state.notifications)
  const removeNotification = useUIStore((state) => state.removeNotification)

  // Compute player's active session
  const activeSession: ActiveSessionInfo | null = useMemo(() => {
    const playerTherapist = therapists.find((t) => t.isPlayer)
    if (!playerTherapist) return null

    const playerSession = sessions.find(
      (s) => s.therapistId === playerTherapist.id && s.status === 'in_progress'
    )
    if (!playerSession) return null

    return {
      clientName: playerSession.clientName,
      progress: playerSession.progress,
      durationMinutes: playerSession.durationMinutes,
      isVirtual: playerSession.isVirtual,
    }
  }, [therapists, sessions])

  const handleCloseModal = useCallback(() => {
    closeModal()
  }, [closeModal])

  const skipEnabled = useMemo(() => {
    return !sessions.some((s) => s.status === 'in_progress')
  }, [sessions])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HUD */}
      <HUD
        day={currentDay}
        hour={currentHour}
        minute={currentMinute}
        speed={gameSpeed}
        isPaused={isPaused}
        balance={balance}
        reputation={reputation}
        practiceLevel={practiceLevel}
        activeSession={activeSession}
        onSpeedChange={onSpeedChange}
        onSkip={onSkip}
        skipEnabled={skipEnabled}
        onSettingsClick={() => openModal('settings')}
        onHelpClick={() => openModal('help')}
      />

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Game Area */}
        <div className="flex-1 p-4">{children}</div>

        {/* Side Panel */}
        {sidePanel && (
          <aside className="w-80 border-l border-border bg-card p-4">{sidePanel}</aside>
        )}
      </main>

      {/* Toast Notifications */}
      <ToastContainer position="bottom-right">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onDismiss={() => removeNotification(notification.id)}
          />
        ))}
      </ToastContainer>

      {/* Settings Modal */}
      <SettingsModal
        open={activeModal?.type === 'settings'}
        onClose={handleCloseModal}
        onNewGame={onNewGame ?? (() => {})}
      />

      {/* Cheat Modal */}
      <CheatModal
        open={activeModal?.type === 'cheats'}
        onClose={handleCloseModal}
      />

      {/* Help Modal */}
      <HelpModal
        open={activeModal?.type === 'help'}
        onClose={handleCloseModal}
      />
    </div>
  )
}
