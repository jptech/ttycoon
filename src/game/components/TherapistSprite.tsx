import { useRef, useCallback, useState } from 'react'
import type { Container, Graphics } from 'pixi.js'
import { useTick } from '@pixi/react'
import type { TherapistCanvasState } from '../types'

interface TherapistSpriteProps {
  state: TherapistCanvasState
  /** Session duration in minutes (default 50) */
  sessionDuration?: number
}

export function TherapistSprite({ state, sessionDuration = 50 }: TherapistSpriteProps) {
  const containerRef = useRef<Container>(null)
  const [pulsePhase, setPulsePhase] = useState(0)

  // Smooth movement and pulse animation
  useTick((ticker) => {
    if (containerRef.current) {
      const dt = ticker.deltaTime
      const speed = 0.15 // Adjust speed as needed

      // Lerp position
      containerRef.current.x += (state.targetPosition.x - containerRef.current.x) * speed * dt
      containerRef.current.y += (state.targetPosition.y - containerRef.current.y) * speed * dt
    }

    // Update pulse phase for glow animation
    if (state.isInSession) {
      setPulsePhase((prev) => (prev + 0.03 * ticker.deltaTime) % (Math.PI * 2))
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

  // Pulsing glow effect when in session
  const drawGlow = useCallback(
    (g: Graphics) => {
      g.clear()
      if (state.isInSession) {
        const glowAlpha = 0.15 + 0.1 * Math.sin(pulsePhase)
        const glowRadius = 24 + 4 * Math.sin(pulsePhase)

        // Outer glow
        g.fill({ color: 0x22c55e, alpha: glowAlpha * 0.5 })
        g.circle(0, 0, glowRadius + 6)
        g.fill()

        // Inner glow
        g.fill({ color: 0x22c55e, alpha: glowAlpha })
        g.circle(0, 0, glowRadius)
        g.fill()
      }
    },
    [state.isInSession, pulsePhase]
  )

  // Calculate time remaining
  const getTimeRemaining = (): string => {
    if (!state.isInSession) return ''
    const remainingProgress = 1 - state.sessionProgress
    const remainingMinutes = Math.ceil(remainingProgress * sessionDuration)
    return `${remainingMinutes}m`
  }

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

  const timeRemaining = getTimeRemaining()

  return (
    <pixiContainer
      ref={containerRef}
      x={state.targetPosition.x} // Initial position
      y={state.targetPosition.y}
    >
      {/* Pulsing glow effect (behind everything) */}
      <pixiGraphics draw={drawGlow} />

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

      {/* Time remaining display (below sprite) */}
      {state.isInSession && timeRemaining && (
        <pixiText
          text={timeRemaining}
          x={0}
          y={28}
          anchor={0.5}
          style={{
            fontSize: 10,
            fill: 0x22c55e,
            fontWeight: 'bold',
          }}
        />
      )}
    </pixiContainer>
  )
}
