import { describe, expect, test } from 'vitest'
import { getDefaultFurniture } from '@/game/visuals/officeDecor'
import type { RoomConfig } from '@/game/config/roomLayouts'

function room(type: RoomConfig['type']): RoomConfig {
  return {
    id: 'r1',
    type,
    label: 'Room',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: 0xffffff,
  }
}

describe('getDefaultFurniture', () => {
  test('always includes a door', () => {
    const items = getDefaultFurniture(room('therapy'))
    expect(items.some((i) => i.type === 'door')).toBe(true)
  })

  test('waiting includes sofa/coffee table', () => {
    const items = getDefaultFurniture(room('waiting'))
    expect(items.some((i) => i.type === 'sofa')).toBe(true)
    expect(items.some((i) => i.type === 'coffee_table')).toBe(true)
  })

  test('therapy includes desk and chairs', () => {
    const items = getDefaultFurniture(room('therapy'))
    expect(items.some((i) => i.type === 'desk')).toBe(true)
    expect(items.some((i) => i.type === 'chair')).toBe(true)
  })

  test('break includes coffee machine', () => {
    const items = getDefaultFurniture(room('break'))
    expect(items.some((i) => i.type === 'coffee_machine')).toBe(true)
  })
})
