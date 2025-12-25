import type { RoomConfig } from './config/roomLayouts'

/**
 * Position in 2D space
 */
export interface Position {
  x: number
  y: number
}

/**
 * Therapist position and state for canvas rendering
 */
export interface TherapistCanvasState {
  therapistId: string
  displayName: string
  initial: string
  color: number
  position: Position
  targetPosition: Position
  isMoving: boolean
  isInSession: boolean
  sessionProgress: number
  roomId: string | null
  status: string // 'available' | 'in_session' | 'on_break' | ...
  isVirtual?: boolean
}

/**
 * Client position and state for canvas rendering
 */
export interface ClientCanvasState {
  clientId: string
  color: number
  position: Position
  targetPosition: Position
  isMoving: boolean
  roomId: string | null
}

/**
 * Props for the OfficeCanvas component
 */
export interface OfficeCanvasProps {
  buildingId: string
  className?: string
}

/**
 * Room with assigned therapist info
 */
export interface RoomWithTherapist extends RoomConfig {
  occupiedBy: string | null
}
