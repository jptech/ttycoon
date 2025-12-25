import { useCallback, useRef } from 'react'
import { Graphics, Container } from 'pixi.js'
import { useTick } from '@pixi/react'

interface ClientSpriteProps {
  x: number
  y: number
  color?: number
}

export function ClientSprite({ x, y, color = 0x60a5fa }: ClientSpriteProps) {
  const containerRef = useRef<Container>(null)

  // Smooth movement
  useTick((ticker) => {
    if (containerRef.current) {
      const dt = ticker.deltaTime
      const speed = 0.15
      
      containerRef.current.x += (x - containerRef.current.x) * speed * dt
      containerRef.current.y += (y - containerRef.current.y) * speed * dt
    }
  })

  const draw = useCallback(
    (g: Graphics) => {
      g.clear()
      
      // Body (Pawn shape)
      g.fill({ color })
      // Shoulders
      g.ellipse(0, 4, 8, 5)
      g.fill()
      // Head
      g.circle(0, -4, 5)
      g.fill()
      
      // Border
      g.stroke({ width: 1.5, color: 0xffffff })
      g.ellipse(0, 4, 8, 5)
      g.circle(0, -4, 5)
      g.stroke()
    },
    [color]
  )

  return (
    <pixiContainer ref={containerRef} x={x} y={y}>
      <pixiGraphics draw={draw} />
    </pixiContainer>
  )
}
