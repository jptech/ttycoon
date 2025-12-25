import type { FurnitureItem, RoomConfig, RoomType } from '../config/roomLayouts'

const WOOD_LIGHT = 0xb08968
const WOOD_DARK = 0x7f5539
const FABRIC_BLUE = 0x60a5fa
const FABRIC_PURPLE = 0xa78bfa
const FABRIC_GREEN = 0x34d399
const METAL_DARK = 0x374151
const PAPER = 0xf3f4f6

function door(x: number, y: number): FurnitureItem {
  return { type: 'door', x, y, width: 0.18, height: 0.08, color: WOOD_DARK }
}

function windowItem(x: number, y: number): FurnitureItem {
  return { type: 'window', x, y, width: 0.22, height: 0.12, color: 0x93c5fd }
}

export function getDefaultFurniture(room: RoomConfig): FurnitureItem[] {
  // NOTE: All coords are relative (0-1) inside the room.
  const base: FurnitureItem[] = [door(0.5, 0.98)]

  const byType: Record<RoomType, FurnitureItem[]> = {
    waiting: [
      windowItem(0.85, 0.12),
      { type: 'rug', x: 0.55, y: 0.55, width: 0.7, height: 0.65, color: 0xe5e7eb },
      { type: 'sofa', x: 0.25, y: 0.55, width: 0.38, height: 0.18, color: FABRIC_BLUE },
      { type: 'sofa', x: 0.65, y: 0.72, width: 0.38, height: 0.18, color: FABRIC_PURPLE },
      { type: 'coffee_table', x: 0.45, y: 0.62, width: 0.18, height: 0.12, color: WOOD_LIGHT },
      { type: 'plant', x: 0.1, y: 0.15 },
      { type: 'plant', x: 0.9, y: 0.2 },
      { type: 'art', x: 0.5, y: 0.15, width: 0.22, height: 0.16 },
    ],
    therapy: [
      windowItem(0.15, 0.12),
      { type: 'rug', x: 0.5, y: 0.62, width: 0.62, height: 0.48, color: 0xe5e7eb },
      { type: 'desk', x: 0.55, y: 0.18, width: 0.45, height: 0.16, color: WOOD_DARK },
      { type: 'chair', x: 0.55, y: 0.33, width: 0.16, height: 0.1, color: METAL_DARK },
      { type: 'chair', x: 0.35, y: 0.62, width: 0.16, height: 0.1, color: 0x4b5563, rotation: 0.8 },
      { type: 'chair', x: 0.7, y: 0.62, width: 0.16, height: 0.1, color: 0x4b5563, rotation: -0.8 },
      { type: 'bookshelf', x: 0.9, y: 0.22, width: 0.16, height: 0.32, color: WOOD_LIGHT },
      { type: 'plant', x: 0.1, y: 0.2 },
      { type: 'art', x: 0.55, y: 0.45, width: 0.2, height: 0.15 },
    ],
    office: [
      windowItem(0.8, 0.12),
      { type: 'rug', x: 0.52, y: 0.6, width: 0.65, height: 0.5, color: 0xe5e7eb },
      { type: 'desk', x: 0.55, y: 0.25, width: 0.5, height: 0.18, color: WOOD_DARK },
      { type: 'chair', x: 0.55, y: 0.42, width: 0.18, height: 0.12, color: METAL_DARK },
      { type: 'lamp', x: 0.15, y: 0.22 },
      { type: 'bookshelf', x: 0.15, y: 0.75, width: 0.18, height: 0.28, color: WOOD_LIGHT },
      { type: 'plant', x: 0.9, y: 0.85 },
      { type: 'art', x: 0.45, y: 0.55, width: 0.18, height: 0.14 },
    ],
    break: [
      windowItem(0.78, 0.12),
      { type: 'rug', x: 0.52, y: 0.6, width: 0.7, height: 0.55, color: 0xe5e7eb },
      { type: 'counter', x: 0.25, y: 0.18, width: 0.5, height: 0.14, color: WOOD_LIGHT },
      { type: 'coffee_machine', x: 0.25, y: 0.14, width: 0.14, height: 0.12, color: 0x111827 },
      { type: 'coffee_table', x: 0.55, y: 0.62, width: 0.22, height: 0.14, color: WOOD_DARK },
      { type: 'sofa', x: 0.75, y: 0.78, width: 0.38, height: 0.18, color: FABRIC_GREEN },
      { type: 'plant', x: 0.1, y: 0.85 },
      { type: 'art', x: 0.52, y: 0.35, width: 0.22, height: 0.16 },
    ],
  }

  return [...base, ...byType[room.type]]
}

export const DECOR_COLORS = {
  woodLight: WOOD_LIGHT,
  woodDark: WOOD_DARK,
  paper: PAPER,
  metalDark: METAL_DARK,
}
