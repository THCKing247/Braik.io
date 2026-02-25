function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "")
}

export function getAdminEmailDomainAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST || ""
  if (!raw.trim()) {
    return []
  }

  return raw
    .split(",")
    .map(normalizeDomain)
    .filter(Boolean)
}

export function isAdminEmailDomainAllowed(email: string): boolean {
  const allowlist = getAdminEmailDomainAllowlist()
  if (allowlist.length === 0) {
    return true
  }

  const domain = email.trim().toLowerCase().split("@")[1]
  if (!domain) {
    return false
  }

  return allowlist.includes(normalizeDomain(domain))
}
