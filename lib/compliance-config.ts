export const LEGAL_POLICY_VERSIONS = {
  terms: "2026.03.01",
  privacy: "2026.03.01",
  acceptableUse: "2026.03.01",
  aiTransparency: "2026.03.01",
  aiAcknowledgement: "2026.03.01",
  paymentAcknowledgement: "2026.03.01",
} as const

export const LEGAL_POLICY_REVIEW_KEYS = {
  terms: `policy-reviewed:terms:${LEGAL_POLICY_VERSIONS.terms}`,
  privacy: `policy-reviewed:privacy:${LEGAL_POLICY_VERSIONS.privacy}`,
  acceptableUse: `policy-reviewed:acceptable-use:${LEGAL_POLICY_VERSIONS.acceptableUse}`,
  aiTransparency: `policy-reviewed:ai-transparency:${LEGAL_POLICY_VERSIONS.aiTransparency}`,
} as const

export type ComplianceEventType =
  | "policy_acceptance"
  | "ai_acknowledgement"
  | "minor_parental_consent_asserted"
  | "minor_parental_consent_verified"
  | "payment_activation_acknowledgement"
