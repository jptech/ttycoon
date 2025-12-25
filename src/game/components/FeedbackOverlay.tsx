import { useState, useEffect, useRef } from 'react'
import { useTick } from '@pixi/react'
import { EventBus } from '@/core/events/EventBus'
import { GameEvents } from '@/core/events/GameEvents'
import { useGameStore } from '@/store'
import type { TherapistCanvasState } from '../types'

interface FloatingTextItem {
  id: number
  text: string
  x: number
  y: number
  life: number // 0-1
  color: number
  velocity: { x: number, y: number }
}

interface FeedbackOverlayProps {
  therapistStates: TherapistCanvasState[]
}

export function FeedbackOverlay({ therapistStates }: FeedbackOverlayProps) {
  const [items, setItems] = useState<FloatingTextItem[]>([])
  const itemsRef = useRef<FloatingTextItem[]>([])
  const nextId = useRef(0)
  const therapistStatesRef = useRef(therapistStates)
  
  // Sync refs
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { therapistStatesRef.current = therapistStates }, [therapistStates])

  useEffect(() => {
    const handleSessionCompleted = (payload: { sessionId: string, quality: number, payment: number }) => {
      const { sessionId, quality, payment } = payload
      
      // Find session to get therapist
      const session = useGameStore.getState().sessions.find(s => s.id === sessionId)
      
      let x = 200
      let y = 150
      
      if (session) {
        const therapistState = therapistStatesRef.current.find(t => t.therapistId === session.therapistId)
        if (therapistState) {
          x = therapistState.position.x
          y = therapistState.position.y - 20
        }
      }

      // Add floating text
      const newItem: FloatingTextItem = {
        id: nextId.current++,
        text: `+$${payment}`,
        x,
        y,
        life: 1.0,
        color: 0x22c55e,
        velocity: { x: 0, y: -0.5 }
      }
      
      setItems(prev => [...prev, newItem])
      
      // Also show quality if high
      if (quality > 0.8) {
        const qualityItem: FloatingTextItem = {
          id: nextId.current++,
          text: 'Great!',
          x: x + 20,
          y: y - 10,
          life: 1.0,
          color: 0xf59e0b,
          velocity: { x: 0.2, y: -0.5 }
        }
        setItems(prev => [...prev, qualityItem])
      }
    }
    
    EventBus.on(GameEvents.SESSION_COMPLETED, handleSessionCompleted)
    return () => EventBus.off(GameEvents.SESSION_COMPLETED, handleSessionCompleted)
  }, [])

  // Animation loop
  useTick((ticker) => {
    if (itemsRef.current.length === 0) return
    
    const dt = ticker.deltaTime
    const decay = 0.015 * dt
    
    const newItems = itemsRef.current.map(item => ({
      ...item,
      x: item.x + item.velocity.x * dt,
      y: item.y + item.velocity.y * dt,
      life: item.life - decay
    })).filter(item => item.life > 0)
    
    // Only update state if items changed (optimization)
    // Since we animate every frame, we do need to update state to re-render positions.
    // To avoid React overhead, we could use refs for individual text items, but this is simpler for now.
    setItems(newItems)
  })

  return (
    <pixiContainer>
      {items.map(item => (
        <pixiText
          key={item.id}
          text={item.text}
          x={item.x}
          y={item.y}
          alpha={item.life}
          style={{
            fontSize: 16,
            fill: item.color,
            fontWeight: 'bold',
            stroke: { color: 0xffffff, width: 3 },
            dropShadow: {
              color: 0x000000,
              blur: 2,
              distance: 1,
            },
          }}
        />
      ))}
    </pixiContainer>
  )
}
