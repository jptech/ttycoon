/**
 * Room types in the office
 */
export type RoomType = 'therapy' | 'waiting' | 'office' | 'break'

/**
 * Configuration for a single room
 */
export interface RoomConfig {
  id: string
  type: RoomType
  label: string
  x: number
  y: number
  width: number
  height: number
  color: number
}

/**
 * Layout configuration for a building
 */
export interface RoomLayout {
  buildingId: string
  canvasWidth: number
  canvasHeight: number
  rooms: RoomConfig[]
}

/**
 * Color palette for room types
 */
export const ROOM_COLORS: Record<RoomType, number> = {
  therapy: 0x4f46e5, // Purple - therapy rooms
  waiting: 0x3b82f6, // Blue - waiting area
  office: 0x22c55e, // Green - office
  break: 0xf59e0b, // Amber - break room
}

/**
 * Room layouts for each building type
 * Coordinates are relative to a base canvas size
 */
export const ROOM_LAYOUTS: Record<string, RoomLayout> = {
  starter_suite: {
    buildingId: 'starter_suite',
    canvasWidth: 400,
    canvasHeight: 300,
    rooms: [
      {
        id: 'waiting',
        type: 'waiting',
        label: 'Waiting',
        x: 20,
        y: 20,
        width: 160,
        height: 120,
        color: ROOM_COLORS.waiting,
      },
      {
        id: 'therapy_1',
        type: 'therapy',
        label: 'Therapy 1',
        x: 200,
        y: 20,
        width: 180,
        height: 260,
        color: ROOM_COLORS.therapy,
      },
    ],
  },

  small_office: {
    buildingId: 'small_office',
    canvasWidth: 500,
    canvasHeight: 300,
    rooms: [
      {
        id: 'waiting',
        type: 'waiting',
        label: 'Waiting',
        x: 20,
        y: 20,
        width: 120,
        height: 120,
        color: ROOM_COLORS.waiting,
      },
      {
        id: 'therapy_1',
        type: 'therapy',
        label: 'Therapy 1',
        x: 160,
        y: 20,
        width: 150,
        height: 260,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_2',
        type: 'therapy',
        label: 'Therapy 2',
        x: 330,
        y: 20,
        width: 150,
        height: 260,
        color: ROOM_COLORS.therapy,
      },
    ],
  },

  professional_suite: {
    buildingId: 'professional_suite',
    canvasWidth: 600,
    canvasHeight: 350,
    rooms: [
      {
        id: 'waiting',
        type: 'waiting',
        label: 'Waiting',
        x: 20,
        y: 20,
        width: 140,
        height: 100,
        color: ROOM_COLORS.waiting,
      },
      {
        id: 'break',
        type: 'break',
        label: 'Break Room',
        x: 20,
        y: 140,
        width: 140,
        height: 100,
        color: ROOM_COLORS.break,
      },
      {
        id: 'therapy_1',
        type: 'therapy',
        label: 'Therapy 1',
        x: 180,
        y: 20,
        width: 130,
        height: 220,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_2',
        type: 'therapy',
        label: 'Therapy 2',
        x: 330,
        y: 20,
        width: 130,
        height: 220,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_3',
        type: 'therapy',
        label: 'Therapy 3',
        x: 480,
        y: 20,
        width: 100,
        height: 220,
        color: ROOM_COLORS.therapy,
      },
    ],
  },

  medical_building: {
    buildingId: 'medical_building',
    canvasWidth: 650,
    canvasHeight: 400,
    rooms: [
      {
        id: 'waiting',
        type: 'waiting',
        label: 'Waiting',
        x: 20,
        y: 20,
        width: 140,
        height: 100,
        color: ROOM_COLORS.waiting,
      },
      {
        id: 'office',
        type: 'office',
        label: 'Office',
        x: 20,
        y: 140,
        width: 140,
        height: 80,
        color: ROOM_COLORS.office,
      },
      {
        id: 'break',
        type: 'break',
        label: 'Break Room',
        x: 20,
        y: 240,
        width: 140,
        height: 80,
        color: ROOM_COLORS.break,
      },
      {
        id: 'therapy_1',
        type: 'therapy',
        label: 'Therapy 1',
        x: 180,
        y: 20,
        width: 110,
        height: 180,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_2',
        type: 'therapy',
        label: 'Therapy 2',
        x: 310,
        y: 20,
        width: 110,
        height: 180,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_3',
        type: 'therapy',
        label: 'Therapy 3',
        x: 440,
        y: 20,
        width: 110,
        height: 180,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_4',
        type: 'therapy',
        label: 'Therapy 4',
        x: 570,
        y: 20,
        width: 60,
        height: 180,
        color: ROOM_COLORS.therapy,
      },
    ],
  },

  premium_clinic: {
    buildingId: 'premium_clinic',
    canvasWidth: 700,
    canvasHeight: 450,
    rooms: [
      {
        id: 'waiting',
        type: 'waiting',
        label: 'Waiting',
        x: 20,
        y: 20,
        width: 160,
        height: 120,
        color: ROOM_COLORS.waiting,
      },
      {
        id: 'office',
        type: 'office',
        label: 'Office',
        x: 20,
        y: 160,
        width: 160,
        height: 80,
        color: ROOM_COLORS.office,
      },
      {
        id: 'break',
        type: 'break',
        label: 'Break Room',
        x: 20,
        y: 260,
        width: 160,
        height: 100,
        color: ROOM_COLORS.break,
      },
      {
        id: 'therapy_1',
        type: 'therapy',
        label: 'Therapy 1',
        x: 200,
        y: 20,
        width: 100,
        height: 200,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_2',
        type: 'therapy',
        label: 'Therapy 2',
        x: 320,
        y: 20,
        width: 100,
        height: 200,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_3',
        type: 'therapy',
        label: 'Therapy 3',
        x: 440,
        y: 20,
        width: 100,
        height: 200,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_4',
        type: 'therapy',
        label: 'Therapy 4',
        x: 560,
        y: 20,
        width: 100,
        height: 200,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_5',
        type: 'therapy',
        label: 'Therapy 5',
        x: 200,
        y: 240,
        width: 100,
        height: 120,
        color: ROOM_COLORS.therapy,
      },
      {
        id: 'therapy_6',
        type: 'therapy',
        label: 'Therapy 6',
        x: 320,
        y: 240,
        width: 100,
        height: 120,
        color: ROOM_COLORS.therapy,
      },
    ],
  },
}

/**
 * Get room layout for a building
 */
export function getRoomLayout(buildingId: string): RoomLayout | null {
  return ROOM_LAYOUTS[buildingId] || null
}

/**
 * Get all therapy rooms for a building
 */
export function getTherapyRooms(buildingId: string): RoomConfig[] {
  const layout = getRoomLayout(buildingId)
  if (!layout) return []
  return layout.rooms.filter((r) => r.type === 'therapy')
}

/**
 * Get waiting room for a building
 */
export function getWaitingRoom(buildingId: string): RoomConfig | null {
  const layout = getRoomLayout(buildingId)
  if (!layout) return null
  return layout.rooms.find((r) => r.type === 'waiting') || null
}
