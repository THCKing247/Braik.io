import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LegalReadTracker } from "@/components/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"

export default function PrivacyPage() {
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
            Privacy Policy
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

            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#3B82F6]">PRIVACY POLICY</p>
              <p>Effective Date: 03/01/2026</p>
              <p>Company: Apex Technical Solutions Group LLC</p>
              <p>Product: Braik</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">1. Information We Collect</h2>
              <p>We may collect:</p>
              <p className="font-semibold">Account Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Name</li>
                <li>Email address</li>
                <li>Role (Coach, Player, Parent)</li>
                <li>Team affiliation</li>
              </ul>
              <p className="font-semibold">Usage Data</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Login activity</li>
                <li>Feature interactions</li>
                <li>Messaging data</li>
                <li>Uploaded content</li>
              </ul>
              <p className="font-semibold">Payment Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Limited billing data via third-party processors</li>
              </ul>
              <p className="font-semibold">AI Processing Data</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Documents submitted for analysis</li>
                <li>Images uploaded for configuration</li>
                <li>Practice schedules and spreadsheets</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">2. How We Use Information</h2>
              <p>We use data to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Provide team management services</li>
                <li>Enable AI functionality</li>
                <li>Improve platform features</li>
                <li>Provide customer support</li>
                <li>Maintain security</li>
              </ul>
              <p>We do not sell personal data.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">3. Data Sharing</h2>
              <p>We may share data:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>With payment processors</li>
                <li>With cloud hosting providers</li>
                <li>To comply with legal obligations</li>
              </ul>
              <p>We do not sell or rent user data to advertisers.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                4. Data Storage & Retention
              </h2>
              <p>Data is stored on secure cloud infrastructure.</p>
              <p>We retain data:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>As long as an account is active</li>
                <li>As required for legal compliance</li>
                <li>Until user requests deletion (where applicable)</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                5. Minor Data Protection
              </h2>
              <p>For users under 18:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Data is associated with a parent or coach account</li>
                <li>Parents may request review or deletion</li>
                <li>We limit exposure of minor data within team environments only</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">6. Security Measures</h2>
              <p>We use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Encrypted connections (HTTPS)</li>
                <li>Role-based access controls</li>
                <li>Secure authentication systems</li>
              </ul>
              <p>However, no system is 100% secure.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">7. User Rights</h2>
              <p>Users may:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Request data deletion</li>
                <li>Update account information</li>
                <li>Request a copy of stored personal data</li>
              </ul>
              <p>Contact: [Insert Support Email]</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">8. Cookies & Tracking</h2>
              <p>Braik may use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Session cookies</li>
                <li>Authentication tokens</li>
                <li>Basic analytics tools</li>
              </ul>
              <p>We do not use invasive third-party advertising trackers.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">9. Changes to Policy</h2>
              <p>We may update this Privacy Policy periodically. Continued use constitutes acceptance.</p>
            </div>

            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.privacy}
              policyVersion={LEGAL_POLICY_VERSIONS.privacy}
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
