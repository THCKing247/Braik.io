import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LegalReadTracker } from "@/components/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h1 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-12 text-[#3B82F6] uppercase tracking-tight">
            Acceptable Use Policy
          </h1>
          <div
            className="max-w-4xl mx-auto p-8 md:p-10 rounded-[14px] relative overflow-hidden text-white space-y-6"
            style={{
              backgroundColor: "rgba(28, 28, 28, 0.9)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
            <p className="text-lg font-semibold text-[#3B82F6]">BRAIK ACCEPTABLE USE POLICY</p>
            <p>
              Braik is built to support coaches, players, and families with clear communication and organized team
              operations. To protect that environment, all users must follow this policy.
            </p>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">Allowed Use</h2>
              <p>Use Braik for team operations, scheduling, documents, messaging, payments, and approved coaching workflows.</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">Prohibited Use</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Harassment, bullying, intimidation, or discriminatory behavior</li>
                <li>Uploading harmful, malicious, unlawful, or unauthorized copyrighted content</li>
                <li>Misuse of team data, player data, or minor information</li>
                <li>Credential sharing, impersonation, or unauthorized access attempts</li>
                <li>Using AI tools for deceptive or unsafe instructions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">Coaches & Staff</h2>
              <p>
                Coaches and staff are responsible for setting communication expectations, moderating team channels, and
                enforcing safe usage standards.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">Enforcement</h2>
              <p>
                Violations may result in warning, feature restrictions, suspension, or account termination. Serious or
                repeated violations may be escalated immediately.
              </p>
            </div>
            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.acceptableUse}
              policyVersion={LEGAL_POLICY_VERSIONS.acceptableUse}
            />
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
