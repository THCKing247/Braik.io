import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { LegalReadTracker } from "@/components/marketing/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import {
  MarketingHeroBlobs,
  MarketingLegalDocument,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-14 md:py-20">
        <MarketingHeroBlobs />
        <div className={`${marketingSectionShell} relative z-10`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-center mb-10 md:mb-12 text-[#212529] uppercase tracking-tight">
            Privacy Policy
          </h1>
          <MarketingLegalDocument>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#3B82F6]">PRIVACY POLICY</p>
              <p>Effective Date: March 22, 2026</p>
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
                <li>Mobile phone number (if you choose to provide it)</li>
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
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                3. SMS Communications and Mobile Information
              </h2>
              <p>
                If you voluntarily provide a mobile phone number, Braik may use it to send transactional SMS messages related to
                team participation and account activity—for example, team invitations, roster or schedule updates, and
                security or sign-in alerts. These messages are not sent for unrelated third-party marketing.
              </p>
              <p>Message frequency varies based on your team&apos;s activity. You can opt out of SMS at any time by replying STOP
                to a message. Standard message and data rates may apply depending on your carrier and plan.</p>
              <p>
                Braik may use messaging service providers (such as carrier-connected SMS gateways) solely to deliver these
                communications. We do not sell SMS opt-in data, and we do not share it with third parties for their own
                marketing purposes. We may retain consent records (for example, time, method, and source of opt-in) for
                compliance, security, and operational purposes.
              </p>
              <p>
                For full terms that apply when you opt in, see the{" "}
                <Link href="/terms" className="text-[#60A5FA] underline hover:text-white">
                  Terms of Service
                </Link>
                .
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">4. Data Sharing</h2>
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
                5. Data Storage & Retention
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
                6. Minor Data Protection
              </h2>
              <p>For users under 18:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Data is associated with a parent or coach account</li>
                <li>Parents may request review or deletion</li>
                <li>We limit exposure of minor data within team environments only</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">7. Security Measures</h2>
              <p>We use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Encrypted connections (HTTPS)</li>
                <li>Role-based access controls</li>
                <li>Secure authentication systems</li>
              </ul>
              <p>However, no system is 100% secure.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">8. User Rights</h2>
              <p>Users may:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Request data deletion</li>
                <li>Update account information</li>
                <li>Request a copy of stored personal data</li>
              </ul>
              <p>
                Contact Braik:{" "}
                <a href="mailto:support@braik.io" className="text-[#60A5FA] underline hover:text-white">
                  support@braik.io
                </a>
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">9. Cookies & Tracking</h2>
              <p>Braik may use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Session cookies</li>
                <li>Authentication tokens</li>
                <li>Basic analytics tools</li>
              </ul>
              <p>We do not use invasive third-party advertising trackers.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">10. Changes to Policy</h2>
              <p>We may update this Privacy Policy periodically. Continued use constitutes acceptance.</p>
            </div>

            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.privacy}
              policyVersion={LEGAL_POLICY_VERSIONS.privacy}
            />
          </MarketingLegalDocument>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
