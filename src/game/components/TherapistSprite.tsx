import { useRef, useCallback } from 'react'
import type { Container, Graphics } from 'pixi.js'
import { useTick } from '@pixi/react'
import type { TherapistCanvasState } from '../types'

interface TherapistSpriteProps {
  state: TherapistCanvasState
}

export function TherapistSprite({ state }: TherapistSpriteProps) {
  const containerRef = useRef<Container>(null)
  
  // Smooth movement
  useTick((ticker) => {
    if (containerRef.current) {
      const dt = ticker.deltaTime
      const speed = 0.15 // Adjust speed as needed
      
      // Lerp position
      containerRef.current.x += (state.targetPosition.x - containerRef.current.x) * speed * dt
      containerRef.current.y += (state.targetPosition.y - containerRef.current.y) * speed * dt
    }
  })

  const drawCircle = useCallback(
    (g: Graphics) => {
      g.clear()
      g.fill({ color: state.color })
      g.circle(0, 0, 14)
      g.fill()
      g.stroke({ width: 2, color: 0xffffff })
      g.circle(0, 0, 14)
      g.stroke()
    },
    [state.color]
  )

  const drawProgress = useCallback(
    (g: Graphics) => {
      g.clear()
      if (state.isInSession) {
        // Background ring
        g.stroke({ width: 3, color: 0x333333 })
        g.arc(0, 0, 18, 0, Math.PI * 2)
        g.stroke()
        // Progress ring
        g.stroke({ width: 3, color: 0x22c55e })
        g.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.sessionProgress)
        g.stroke()
      }
    },
    [state.isInSession, state.sessionProgress]
  )

  const drawStatus = useCallback(
    (g: Graphics) => {
      g.clear()
      if (state.status === 'on_break') {
        // Coffee cup bubble
        g.fill({ color: 0xffffff })
        g.circle(10, -10, 8)
        g.fill()
        // Cup
        g.fill({ color: 0x8b4513 })
        g.rect(6, -12, 8, 6)
        g.fill()
      } else if (state.isVirtual) {
        // Laptop bubble
        g.fill({ color: 0xffffff })
        g.circle(10, -10, 8)
        g.fill()
        // Laptop icon
        g.fill({ color: 0x333333 })
        g.rect(5, -13, 10, 6)
        g.fill()
      }
    },
    [state.status, state.isVirtual]
  )

  return (
    <pixiContainer 
      ref={containerRef} 
      x={state.targetPosition.x} // Initial position
      y={state.targetPosition.y}
    >
      {/* Session progress ring */}
      <pixiGraphics draw={drawProgress} />

      {/* Therapist circle */}
      <pixiGraphics draw={drawCircle} />

      {/* Status Icon */}
      <pixiGraphics draw={drawStatus} />

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
  )
}
