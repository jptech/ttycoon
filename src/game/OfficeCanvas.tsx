import { useMemo } from 'react'
import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useGameStore } from '@/store'
import { getRoomLayout, ROOM_COLORS } from './config/roomLayouts'
import type { OfficeCanvasProps, TherapistCanvasState, Position } from './types'

// Extend PIXI components for @pixi/react
extend({ Container, Graphics, Text })

/**
 * Color palette for therapists
 */
const THERAPIST_COLORS = [
  0x22c55e, // Green
  0x3b82f6, // Blue
  0xf59e0b, // Amber
  0xef4444, // Red
  0x8b5cf6, // Purple
  0xec4899, // Pink
]

/**
 * Get a color for a therapist based on their index
 */
function getTherapistColor(index: number): number {
  return THERAPIST_COLORS[index % THERAPIST_COLORS.length]
}

/**
 * Office Canvas - PixiJS visualization of the office layout
 */
export function OfficeCanvas({ buildingId, className }: OfficeCanvasProps) {
  const therapists = useGameStore((state) => state.therapists)
  const sessions = useGameStore((state) => state.sessions)

  const layout = useMemo(() => getRoomLayout(buildingId), [buildingId])

  // Calculate therapist positions based on their status
  const therapistStates = useMemo((): TherapistCanvasState[] => {
    if (!layout) return []

    const therapyRooms = layout.rooms.filter((r) => r.type === 'therapy')
    const waitingRoom = layout.rooms.find((r) => r.type === 'waiting')
    const breakRoom = layout.rooms.find((r) => r.type === 'break')

    // Track which therapy rooms are occupied
    const roomAssignments = new Map<string, string>()

    return therapists.map((therapist, index) => {
      // Find if therapist is in an active session
      const activeSession = sessions.find(
        (s) => s.therapistId === therapist.id && s.status === 'in_progress'
      )

      let position: Position
      let roomId: string | null = null
      let isInSession = false
      let sessionProgress = 0

      if (activeSession) {
        // Therapist is in session - find an available therapy room
        const availableRoom = therapyRooms.find(
          (r) => !roomAssignments.has(r.id)
        )
        if (availableRoom) {
          roomAssignments.set(availableRoom.id, therapist.id)
          position = {
            x: availableRoom.x + availableRoom.width / 2,
            y: availableRoom.y + availableRoom.height / 2,
          }
          roomId = availableRoom.id
          isInSession = true
          sessionProgress = activeSession.progress
        } else {
          // Fallback to waiting room
          position = waitingRoom
            ? { x: waitingRoom.x + 30 + index * 25, y: waitingRoom.y + 50 }
            : { x: 50 + index * 30, y: 50 }
        }
      } else if (therapist.status === 'on_break' && breakRoom) {
        // Therapist is on break
        position = {
          x: breakRoom.x + 30 + (index % 4) * 25,
          y: breakRoom.y + 40,
        }
        roomId = breakRoom.id
      } else {
        // Therapist is in waiting area
        position = waitingRoom
          ? { x: waitingRoom.x + 30 + (index % 4) * 25, y: waitingRoom.y + 50 }
          : { x: 50 + index * 30, y: 50 }
        roomId = waitingRoom?.id || null
      }

      return {
        therapistId: therapist.id,
        displayName: therapist.displayName,
        initial: therapist.displayName.charAt(0).toUpperCase(),
        color: getTherapistColor(index),
        position,
        targetPosition: position,
        isMoving: false,
        isInSession,
        sessionProgress,
        roomId,
      }
    })
  }, [therapists, sessions, layout])

  if (!layout) {
    return (
      <div className={className} style={{ padding: '20px', textAlign: 'center' }}>
        <p>No layout found for building: {buildingId}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <Application
        width={layout.canvasWidth}
        height={layout.canvasHeight}
        backgroundAlpha={0}
        antialias
      >
        {/* Render rooms */}
        {layout.rooms.map((room) => (
          <pixiGraphics
            key={room.id}
            draw={(g) => {
              g.clear()
              // Room background
              g.fill({ color: room.color, alpha: 0.3 })
              g.roundRect(room.x, room.y, room.width, room.height, 8)
              g.fill()
              // Room border
              g.stroke({ width: 2, color: room.color, alpha: 0.8 })
              g.roundRect(room.x, room.y, room.width, room.height, 8)
              g.stroke()
            }}
          />
        ))}

        {/* Room labels */}
        {layout.rooms.map((room) => (
          <pixiText
            key={`label-${room.id}`}
            text={room.label}
            x={room.x + 8}
            y={room.y + 8}
            style={{
              fontSize: 12,
              fill: 0xffffff,
              fontWeight: 'bold',
            }}
          />
        ))}

        {/* Therapist sprites */}
        {therapistStates.map((state) => (
          <pixiContainer key={state.therapistId} x={state.position.x} y={state.position.y}>
            {/* Session progress ring */}
            {state.isInSession && (
              <pixiGraphics
                draw={(g) => {
                  g.clear()
                  // Background ring
                  g.stroke({ width: 3, color: 0x333333 })
                  g.arc(0, 0, 18, 0, Math.PI * 2)
                  g.stroke()
                  // Progress ring
                  g.stroke({ width: 3, color: 0x22c55e })
                  g.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.sessionProgress)
                  g.stroke()
                }}
              />
            )}

            {/* Therapist circle */}
            <pixiGraphics
              draw={(g) => {
                g.clear()
                g.fill({ color: state.color })
                g.circle(0, 0, 14)
                g.fill()
                g.stroke({ width: 2, color: 0xffffff })
                g.circle(0, 0, 14)
                g.stroke()
              }}
            />

            {/* Initial letter */}
            <pixiText
              text={state.initial}
              anchor={0.5}
              style={{
                fontSize: 14,
                fill: 0xffffff,
                fontWeight: 'bold',
              }}
            />
          </pixiContainer>
        ))}
      </Application>

      {/* Legend */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(ROOM_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
                borderRadius: '2px',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: '#a0a0a0', textTransform: 'capitalize' }}>
              {type}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
