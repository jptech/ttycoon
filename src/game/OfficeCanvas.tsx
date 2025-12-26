import { useMemo } from 'react'
import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useGameStore } from '@/store'
import { getRoomLayout, ROOM_COLORS } from './config/roomLayouts'
import { RoomDecor } from './components/RoomDecor'
import { ClientSprite } from './components/ClientSprite'
import { TherapistSprite } from './components/TherapistSprite'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import type { OfficeCanvasProps, TherapistCanvasState, ClientCanvasState, Position } from './types'

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
  const clients = useGameStore((state) => state.clients)
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
      let isVirtual = false

      if (activeSession) {
        // Therapist is in session - find an available therapy room
        const availableRoom = therapyRooms.find(
          (r) => !roomAssignments.has(r.id)
        )
        if (availableRoom) {
          roomAssignments.set(availableRoom.id, therapist.id)
          position = {
            x: availableRoom.x + availableRoom.width / 2 + 15, // Shift right to make room for client
            y: availableRoom.y + availableRoom.height / 2,
          }
          roomId = availableRoom.id
          isInSession = true
          sessionProgress = activeSession.progress
          isVirtual = activeSession.isVirtual
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
        status: therapist.status,
        isVirtual,
      }
    })
  }, [therapists, sessions, layout])

  // Calculate client positions
  const clientStates = useMemo((): ClientCanvasState[] => {
    if (!layout) return []
    
    const waitingRoom = layout.rooms.find((r) => r.type === 'waiting')
    
    // Filter visible clients
    const visibleClients = clients.filter(c => 
      c.status === 'waiting' || 
      (c.status === 'in_treatment' && sessions.some(s => s.clientId === c.id && s.status === 'in_progress'))
    )

    return visibleClients.map((client) => {
      // Check if in session
      const activeSession = sessions.find(
        (s) => s.clientId === client.id && s.status === 'in_progress'
      )
      
      let position: Position
      let roomId: string | null = null
      
      if (activeSession) {
        // Find therapist's room
        const therapistState = therapistStates.find(t => t.therapistId === activeSession.therapistId)
        if (therapistState && therapistState.roomId) {
          // Place client in same room, to the left of therapist
          position = {
            x: therapistState.position.x - 40,
            y: therapistState.position.y
          }
          roomId = therapistState.roomId
        } else {
           // Fallback
           position = { x: -100, y: -100 }
        }
      } else if (client.status === 'waiting' && waitingRoom) {
        // Waiting room grid
        // Only count waiting clients for grid position to avoid gaps
        const waitingIndex = visibleClients
          .filter(c => c.status === 'waiting')
          .findIndex(c => c.id === client.id)
          
        const cols = 5
        const row = Math.floor(waitingIndex / cols)
        const col = waitingIndex % cols
        position = {
          x: waitingRoom.x + 20 + col * 20,
          y: waitingRoom.y + 30 + row * 20
        }
        roomId = waitingRoom.id
      } else {
        return null
      }
      
      if (!position) return null

      return {
        clientId: client.id,
        color: 0x60a5fa,
        position,
        targetPosition: position,
        isMoving: false,
        roomId
      }
    }).filter((c): c is ClientCanvasState => c !== null)
  }, [clients, sessions, layout, therapistStates])

  // Calculate occupied rooms
  const occupiedRoomIds = useMemo(() => {
    const ids = new Set<string>()
    therapistStates.forEach(t => { if (t.roomId) ids.add(t.roomId) })
    clientStates.forEach(c => { if (c.roomId) ids.add(c.roomId) })
    return ids
  }, [therapistStates, clientStates])

  // Calculate rooms with active sessions (for pulsing effect)
  const activeSessionRoomIds = useMemo(() => {
    const ids = new Set<string>()
    therapistStates.forEach(t => {
      if (t.roomId && t.isInSession) ids.add(t.roomId)
    })
    return ids
  }, [therapistStates])

  const roomOccupancyCounts = useMemo(() => {
    const counts = new Map<string, { therapists: number; clients: number }>()
    for (const t of therapistStates) {
      if (!t.roomId) continue
      const current = counts.get(t.roomId) ?? { therapists: 0, clients: 0 }
      current.therapists += 1
      counts.set(t.roomId, current)
    }
    for (const c of clientStates) {
      if (!c.roomId) continue
      const current = counts.get(c.roomId) ?? { therapists: 0, clients: 0 }
      current.clients += 1
      counts.set(c.roomId, current)
    }
    return counts
  }, [therapistStates, clientStates])

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
        {/* Render rooms with decor */}
        {layout.rooms.map((room) => (
          <RoomDecor
            key={room.id}
            room={room}
            isOccupied={occupiedRoomIds.has(room.id)}
            hasActiveSession={activeSessionRoomIds.has(room.id)}
          />
        ))}

        {/* Room labels */}
        {layout.rooms.map((room) => {
          const occ = roomOccupancyCounts.get(room.id)
          const total = occ ? occ.therapists + occ.clients : 0
          const label =
            occ && total > 0
              ? `${room.label} (${occ.therapists}T/${occ.clients}C)`
              : room.label

          return (
          <pixiText
            key={`label-${room.id}`}
            text={label}
            x={room.x + 8}
            y={room.y + 8}
            style={{
              fontSize: 12,
              fill: 0xffffff,
              fontWeight: 'bold',
            }}
          />
          )
        })}

        {/* Client sprites */}
        {clientStates.map((state) => (
          <ClientSprite
            key={state.clientId}
            x={state.position.x}
            y={state.position.y}
            color={state.color}
          />
        ))}

        {/* Therapist sprites */}
        {therapistStates.map((state) => (
          <TherapistSprite key={state.therapistId} state={state} />
        ))}

        {/* Feedback Overlay */}
        <FeedbackOverlay therapistStates={therapistStates} />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#22c55e',
              borderRadius: '999px',
              border: '2px solid white',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>Therapist</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#60a5fa',
              borderRadius: '6px',
              border: '2px solid white',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>Client</span>
        </div>
      </div>
    </div>
  )
}
