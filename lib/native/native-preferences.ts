/**
 * Capacitor Preferences on native (SharedPreferences / UserDefaults).
 * Web fallback: localStorage for non-secret flags only.
 */

const PREF_PREFIX = "braik_np_"

export async function nativePreferenceGet(key: string): Promise<string | null> {
  const full = PREF_PREFIX + key
  if (typeof window === "undefined") return null

  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) {
    try {
      return window.localStorage.getItem(full)
    } catch {
      return null
    }
  }

  const { Preferences } = await import("@capacitor/preferences")
  const { value } = await Preferences.get({ key: full })
  return value ?? null
}

export async function nativePreferenceSet(key: string, value: string): Promise<void> {
  const full = PREF_PREFIX + key
  if (typeof window === "undefined") return

  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) {
    try {
      window.localStorage.setItem(full, value)
    } catch {
      /* ignore */
    }
    return
  }

  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key: full, value })
}

export async function nativePreferenceRemove(key: string): Promise<void> {
  const full = PREF_PREFIX + key
  if (typeof window === "undefined") return

  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) {
    try {
      window.localStorage.removeItem(full)
    } catch {
      /* ignore */
    }
    return
  }

  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.remove({ key: full })
}
