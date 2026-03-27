/**
 * Same-tab, short-lived client memory for safe lightweight GETs.
 * Does not replace server cache or React state — only avoids duplicate network on quick remounts / back-nav.
 */

const entries = new Map<string, { value: unknown; storedAt: number }>()

export function readLightweightMemoryRaw(key: string): { value: unknown; ageMs: number } | null {
  const e = entries.get(key)
  if (!e) return null
  return { value: e.value, ageMs: Date.now() - e.storedAt }
}

export function writeLightweightMemory(key: string, value: unknown): void {
  entries.set(key, { value, storedAt: Date.now() })
}

export function clearLightweightMemoryKey(key: string): void {
  entries.delete(key)
}
