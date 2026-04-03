import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { LegalReadTracker } from "@/components/marketing/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import {
  MarketingHeroBlobs,
  MarketingLegalDocument,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-14 md:py-20">
        <MarketingHeroBlobs />
        <div className={`${marketingSectionShell} relative z-10`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-center mb-10 md:mb-12 text-[#212529] uppercase tracking-tight">
            Acceptable Use Policy
          </h1>
          <MarketingLegalDocument>
            <p className="text-lg font-semibold text-[#3B82F6]">BRAIK ACCEPTABLE USE POLICY</p>
            <p>
              Braik is built to support coaches, players, and families with clear communication and organized team
              operations. To protect that environment, all users must follow this policy.
            </p>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2>Allowed Use</h2>
              <p>Use Braik for team operations, scheduling, documents, messaging, payments, and approved coaching workflows.</p>
            </div>
            <div className="space-y-2">
              <h2>Prohibited Use</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Harassment, bullying, intimidation, or discriminatory behavior</li>
                <li>Uploading harmful, malicious, unlawful, or unauthorized copyrighted content</li>
                <li>Misuse of team data, player data, or minor information</li>
                <li>Credential sharing, impersonation, or unauthorized access attempts</li>
                <li>Using AI tools for deceptive or unsafe instructions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h2>Coaches & Staff</h2>
              <p>
                Coaches and staff are responsible for setting communication expectations, moderating team channels, and
                enforcing safe usage standards.
              </p>
            </div>
            <div className="space-y-2">
              <h2>Enforcement</h2>
              <p>
                Violations may result in warning, feature restrictions, suspension, or account termination. Serious or
                repeated violations may be escalated immediately.
              </p>
            </div>
            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.acceptableUse}
              policyVersion={LEGAL_POLICY_VERSIONS.acceptableUse}
            />
          </MarketingLegalDocument>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
