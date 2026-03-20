import { nativePreferenceGet, nativePreferenceSet, nativePreferenceRemove } from "@/lib/native/native-preferences"

/** User enabled fingerprint / Face ID gate for returning sessions (native). */
const KEY_ENABLED = "biometric_unlock_enabled"
/** One-time post-login “enable unlock?” prompt completed. */
const KEY_POST_LOGIN_PROMPT = "biometric_post_login_prompt_done"

export async function getNativeBiometricUnlockEnabled(): Promise<boolean> {
  const v = await nativePreferenceGet(KEY_ENABLED)
  return v === "true" || v === "1"
}

export async function setNativeBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await nativePreferenceSet(KEY_ENABLED, "true")
  } else {
    await nativePreferenceRemove(KEY_ENABLED)
  }
}

export async function getBiometricPostLoginPromptDone(): Promise<boolean> {
  const v = await nativePreferenceGet(KEY_POST_LOGIN_PROMPT)
  return v === "true" || v === "1"
}

export async function setBiometricPostLoginPromptDone(done: boolean): Promise<void> {
  if (done) {
    await nativePreferenceSet(KEY_POST_LOGIN_PROMPT, "true")
  } else {
    await nativePreferenceRemove(KEY_POST_LOGIN_PROMPT)
  }
}
