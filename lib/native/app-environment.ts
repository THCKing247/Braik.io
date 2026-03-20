/**
 * Capacitor vs browser. `window.__BRAIK_IS_NATIVE_APP__` is set early in `NativeAppBootstrap`.
 */

declare global {
  interface Window {
    __BRAIK_IS_NATIVE_APP__?: boolean
  }
}

export async function getIsNativeApp(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (window.__BRAIK_IS_NATIVE_APP__ === true) return true
  const { Capacitor } = await import("@capacitor/core")
  const v = Capacitor.isNativePlatform()
  window.__BRAIK_IS_NATIVE_APP__ = v
  return v
}

/** After bootstrap runs; false on SSR and before first client paint. */
export function isNativeAppSync(): boolean {
  return typeof window !== "undefined" && window.__BRAIK_IS_NATIVE_APP__ === true
}

export async function getIsWebBrowser(): Promise<boolean> {
  return !(await getIsNativeApp())
}
