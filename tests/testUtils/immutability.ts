export function cloneDeep<T>(value: T): T {
  // Bun + modern runtimes provide structuredClone.
  // Fall back to JSON clone for plain data structures.
  // (Our game state is plain objects/arrays/numbers/strings.)
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value

  Object.freeze(value)

  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }

  return value
}
