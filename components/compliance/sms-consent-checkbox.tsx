"use client"

import Link from "next/link"

const CHECKBOX_LABEL =
  "I agree to receive transactional SMS messages from Braik related to team participation, roster updates, scheduling notifications, and account activity. Message frequency varies. Reply STOP to opt out."

const HELPER_TEXT =
  "Consent is not a condition of purchase. Braik does not sell or share SMS opt-in data with unauthorized third parties."

export function smsConsentCheckboxLabelText(): string {
  return CHECKBOX_LABEL
}

export function smsConsentHelperText(): string {
  return HELPER_TEXT
}

type SmsConsentCheckboxProps = {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * Required when collecting a mobile number for transactional SMS. Includes Privacy + Terms links.
 */
export function SmsConsentCheckbox({ id, checked, onChange, disabled }: SmsConsentCheckboxProps) {
  return (
    <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:p-4">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#3B82F6] disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm leading-relaxed text-[#495057]">
          {CHECKBOX_LABEL}{" "}
          <Link href="/privacy" className="font-medium text-[#2563EB] hover:underline" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-medium text-[#2563EB] hover:underline" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>
          .
        </span>
      </label>
      <p className="text-xs leading-snug text-[#6B7280] pl-7 sm:pl-7">{HELPER_TEXT}</p>
    </div>
  )
}
