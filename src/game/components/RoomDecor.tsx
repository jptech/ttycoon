import { useCallback } from 'react'
import { Graphics } from 'pixi.js'
import type { RoomConfig, FurnitureItem } from '../config/roomLayouts'
import { DECOR_COLORS, getDefaultFurniture } from '../visuals/officeDecor'

interface RoomDecorProps {
  room: RoomConfig
  isOccupied?: boolean
}

export function RoomDecor({ room, isOccupied = false }: RoomDecorProps) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear()
      
      // Room background
      const radius = 12
      const inset = 8

      // Soft shadow (cartoon depth)
      g.fill({ color: 0x000000, alpha: 0.22 })
      g.roundRect(room.x + 4, room.y + 6, room.width, room.height, radius)
      g.fill()

      // Outer wall (tinted)
      g.fill({ color: room.color, alpha: 0.22 })
      g.roundRect(room.x, room.y, room.width, room.height, radius)
      g.fill()

      // Inner floor (neutral warm gray for readability)
      g.fill({ color: 0xf1f5f9, alpha: 0.85 })
      g.roundRect(room.x + inset, room.y + inset, room.width - inset * 2, room.height - inset * 2, radius - 4)
      g.fill()

      // Accent header strip
      g.fill({ color: room.color, alpha: 0.28 })
      g.roundRect(room.x + inset, room.y + inset, room.width - inset * 2, 18, 10)
      g.fill()

      // Subtle floor tile lines
      g.stroke({ width: 1, color: 0x0f172a, alpha: 0.05 })
      const tile = 18
      const x0 = room.x + inset + 2
      const y0 = room.y + inset + 22
      const x1 = room.x + room.width - inset - 2
      const y1 = room.y + room.height - inset - 2
      for (let x = x0; x <= x1; x += tile) {
        g.moveTo(x, y0)
        g.lineTo(x, y1)
      }
      for (let y = y0; y <= y1; y += tile) {
        g.moveTo(x0, y)
        g.lineTo(x1, y)
      }
      g.stroke()

      // Room border
      g.stroke({ width: 2, color: room.color, alpha: 0.65 })
      g.roundRect(room.x, room.y, room.width, room.height, radius)
      g.stroke()

      const furniture = (room.furniture && room.furniture.length > 0)
        ? room.furniture
        : getDefaultFurniture(room)

      // Draw furniture
      furniture.forEach((item: FurnitureItem) => {
        const x = room.x + item.x * room.width
        const y = room.y + item.y * room.height
        const w = item.width ? item.width * room.width : 20
        const h = item.height ? item.height * room.height : 20

        switch (item.type) {
          case 'rug': {
            g.fill({ color: item.color || 0xe5e7eb, alpha: 0.65 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 12)
            g.fill()
            g.fill({ color: 0xffffff, alpha: 0.18 })
            for (let i = 0; i < 3; i++) {
              g.circle(x - w / 4 + (i * w) / 4, y, 2)
            }
            g.fill()
            break
          }

          case 'desk': {
            g.fill({ color: item.color || DECOR_COLORS.woodDark, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 7)
            g.fill()
            // Paper
            g.fill({ color: DECOR_COLORS.paper, alpha: 0.92 })
            g.roundRect(x - w / 9, y - h / 4, w / 4, h / 2, 4)
            g.fill()
            // Subtle highlight
            g.fill({ color: 0xffffff, alpha: 0.08 })
            g.roundRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h * 0.35, 6)
            g.fill()
            break
          }

          case 'chair': {
            g.fill({ color: item.color || DECOR_COLORS.metalDark, alpha: 0.9 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 5)
            g.fill()
            // Backrest
            g.fill({ color: 0x000000, alpha: 0.18 })
            if (item.rotation) {
              if (item.rotation > 0) {
                g.roundRect(x - w / 2, y - h / 2, w / 3, h, 3)
              } else {
                g.roundRect(x + w / 6, y - h / 2, w / 3, h, 3)
              }
            } else {
              g.roundRect(x - w / 2, y - h / 2, w, h / 3, 3)
            }
            g.fill()
            break
          }

          case 'plant': {
            g.fill({ color: 0x8b5e3c, alpha: 0.95 })
            g.roundRect(x - 7, y + 3, 14, 8, 3)
            g.fill()
            g.fill({ color: 0x22c55e, alpha: 0.95 })
            g.circle(x - 6, y - 2, 5)
            g.circle(x + 6, y - 2, 5)
            g.circle(x, y - 7, 6)
            g.fill()
            break
          }

          case 'bookshelf': {
            g.fill({ color: item.color || DECOR_COLORS.woodLight, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 5)
            g.fill()
            g.stroke({ width: 1, color: 0x3e2723, alpha: 0.25 })
            g.moveTo(x - w / 2 + 2, y - h / 6)
            g.lineTo(x + w / 2 - 2, y - h / 6)
            g.moveTo(x - w / 2 + 2, y + h / 6)
            g.lineTo(x + w / 2 - 2, y + h / 6)
            g.stroke()
            for (let i = 0; i < 3; i++) {
              g.fill({ color: [0xef4444, 0x3b82f6, 0xeab308][i % 3], alpha: 0.9 })
              g.roundRect(x - w / 2 + 4, y - h / 2 + 6 + i * (h / 3), w - 8, 10, 2)
              g.fill()
            }
            break
          }

          case 'sofa': {
            g.fill({ color: item.color || 0x60a5fa, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 12)
            g.fill()
            g.fill({ color: 0xffffff, alpha: 0.12 })
            g.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h / 2 - 6, 10)
            g.fill()
            break
          }

          case 'coffee_table': {
            g.fill({ color: item.color || DECOR_COLORS.woodLight, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 7)
            g.fill()
            g.fill({ color: 0xffffff, alpha: 0.9 })
            g.circle(x + w * 0.2, y - h * 0.1, 3)
            g.fill()
            break
          }

          case 'lamp': {
            g.fill({ color: 0x111827, alpha: 0.85 })
            g.roundRect(x - 2, y - 10, 4, 14, 2)
            g.fill()
            g.fill({ color: 0xfde68a, alpha: 0.88 })
            g.roundRect(x - 7, y - 18, 14, 10, 5)
            g.fill()
            break
          }

          case 'art': {
            g.fill({ color: 0x1f2937, alpha: 0.65 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 4)
            g.fill()
            g.fill({ color: 0xffffff, alpha: 0.7 })
            g.roundRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 3)
            g.fill()
            g.fill({ color: room.color, alpha: 0.25 })
            g.circle(x, y, Math.min(w, h) / 4)
            g.fill()
            break
          }

          case 'window': {
            g.fill({ color: item.color || 0x93c5fd, alpha: 0.65 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 7)
            g.fill()
            g.stroke({ width: 2, color: 0xffffff, alpha: 0.6 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 7)
            g.stroke()
            g.stroke({ width: 1, color: 0xffffff, alpha: 0.35 })
            g.moveTo(x, y - h / 2 + 2)
            g.lineTo(x, y + h / 2 - 2)
            g.moveTo(x - w / 2 + 2, y)
            g.lineTo(x + w / 2 - 2, y)
            g.stroke()
            break
          }

          case 'door': {
            g.fill({ color: item.color || DECOR_COLORS.woodDark, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 5)
            g.fill()
            g.fill({ color: 0xfbbf24, alpha: 0.9 })
            g.circle(x + w * 0.25, y, 2)
            g.fill()
            break
          }

          case 'coffee_machine': {
            g.fill({ color: item.color || 0x111827, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 5)
            g.fill()
            g.fill({ color: 0xffffff, alpha: 0.25 })
            g.roundRect(x - w / 4, y - h / 4, w / 2, h / 2, 3)
            g.fill()
            break
          }

          case 'counter': {
            g.fill({ color: item.color || DECOR_COLORS.woodLight, alpha: 0.95 })
            g.roundRect(x - w / 2, y - h / 2, w, h, 7)
            g.fill()
            g.fill({ color: 0x0f172a, alpha: 0.08 })
            g.roundRect(x - w / 2, y - h / 2, w, h * 0.35, 7)
            g.fill()
            break
          }

          default:
            break
        }
      })
      // Lighting: dim empty rooms, add warm glow to occupied rooms
      if (!isOccupied) {
        g.fill({ color: 0x0b1020, alpha: 0.18 })
        g.roundRect(room.x + inset, room.y + inset, room.width - inset * 2, room.height - inset * 2, radius - 4)
        g.fill()
      } else {
        g.stroke({ width: 3, color: 0xfde68a, alpha: 0.18 })
        g.roundRect(room.x + inset + 2, room.y + inset + 2, room.width - inset * 2 - 4, room.height - inset * 2 - 4, radius - 6)
        g.stroke()
      }
    },
    [room, isOccupied]
  )

  return <pixiGraphics draw={draw} />
}
