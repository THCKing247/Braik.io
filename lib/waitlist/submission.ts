export const WAITLIST_ROLE_OPTIONS = [
  { value: "head_coach", label: "Head coach" },
  { value: "athletic_director", label: "Athletic director" },
] as const

export type WaitlistRoleValue = (typeof WAITLIST_ROLE_OPTIONS)[number]["value"]

export const WAITLIST_ROLE_VALUES = new Set<string>(
  WAITLIST_ROLE_OPTIONS.map((o) => o.value)
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidWaitlistEmail(email: string): boolean {
  const t = email.trim()
  return t.length <= 320 && EMAIL_RE.test(t)
}

const MAX_NAME = 120
const MAX_ORG = 200
const MAX_MESSAGE = 2000

export type WaitlistFieldErrors = Partial<
  Record<"firstName" | "lastName" | "email" | "role" | "organizationName" | "message", string>
>

export function validateWaitlistPayload(body: unknown): {
  ok: true
  data: {
    firstName: string
    lastName: string
    email: string
    role: WaitlistRoleValue
    organizationName: string
    message: string | null
  }
} | { ok: false; errors: WaitlistFieldErrors } {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { email: "Invalid request." } }
  }
  const o = body as Record<string, unknown>
  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : ""
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : ""
  const emailRaw = typeof o.email === "string" ? o.email : ""
  const role = typeof o.role === "string" ? o.role.trim() : ""
  const organizationName = typeof o.organizationName === "string" ? o.organizationName.trim() : ""
  const messageRaw = typeof o.message === "string" ? o.message.trim() : ""

  const errors: WaitlistFieldErrors = {}

  if (!firstName) errors.firstName = "First name is required."
  else if (firstName.length > MAX_NAME) errors.firstName = "First name is too long."

  if (!lastName) errors.lastName = "Last name is required."
  else if (lastName.length > MAX_NAME) errors.lastName = "Last name is too long."

  if (!emailRaw.trim()) errors.email = "Email is required."
  else if (!isValidWaitlistEmail(emailRaw)) errors.email = "Enter a valid email address."

  if (!role) errors.role = "Select your role."
  else if (!WAITLIST_ROLE_VALUES.has(role)) errors.role = "Select a valid role."

  if (!organizationName) errors.organizationName = "Organization or team name is required."
  else if (organizationName.length > MAX_ORG) errors.organizationName = "Name is too long."

  if (messageRaw.length > MAX_MESSAGE) errors.message = "Message is too long."

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      email: normalizeWaitlistEmail(emailRaw),
      role: role as WaitlistRoleValue,
      organizationName,
      message: messageRaw ? messageRaw : null,
    },
  }
}
