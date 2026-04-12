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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-14 md:py-20">
        <MarketingHeroBlobs />
        <div className={`${marketingSectionShell} relative z-10`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-center mb-10 md:mb-12 text-[#212529] uppercase tracking-tight">
            Terms of Service
          </h1>
          <MarketingLegalDocument>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#3B82F6]">TERMS OF SERVICE</p>
              <p>Effective Date: 03/01/2026</p>
              <p>Company: Apex Technical Solutions Group LLC</p>
              <p>Product: Braik</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Braik ("Platform"), you agree to be bound by these Terms of Service. If you do
                not agree, you may not use the Platform.
              </p>
              <p>
                Braik is a sports team management and AI-assisted coordination platform designed for coaches,
                assistants, players, and parents.
              </p>
              <p>
                You agree to follow the{" "}
                <Link href="/acceptable-use" className="text-[#60A5FA] underline hover:text-slate-100">
                  Acceptable Use Policy
                </Link>
                , which describes prohibited and restricted uses of the Platform.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">2. Description of Service</h2>
              <p>Braik provides:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Team communication tools</li>
                <li>Role-based access controls</li>
                <li>AI assistant functionality</li>
                <li>Practice and schedule management</li>
                <li>File and image uploads</li>
                <li>Formation and playbook tools</li>
                <li>Payment collection integrations</li>
                <li>Administrative automation tools</li>
              </ul>
              <p>We reserve the right to modify or update features at any time.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                3. User Roles & Account Responsibility
              </h2>
              <p>Users may register under roles including but not limited to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Head Coach</li>
                <li>Assistant Coach</li>
                <li>Player</li>
                <li>Parent/Guardian</li>
                <li>Administrator</li>
              </ul>
              <p>You are responsible for:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Maintaining account confidentiality</li>
                <li>All activity under your login</li>
                <li>Ensuring your role assignment is accurate</li>
              </ul>
              <p>Head Coaches are responsible for managing their team's user permissions.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                4. Youth Protection & Minor Users
              </h2>
              <p>Braik may be used by minors under supervision of a coach or parent.</p>
              <p>Users under 18 must have parental or guardian consent.</p>
              <p>Parents/guardians are responsible for reviewing and approving minor participation.</p>
              <p>Braik does not knowingly collect personal data directly from minors without associated adult oversight.</p>
              <p>We comply with applicable child data protection laws including COPPA where applicable.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">5. AI Assistant Disclaimer</h2>
              <p>Braik includes AI-powered tools to assist with:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Scheduling</li>
                <li>Practice planning</li>
                <li>File interpretation</li>
                <li>Communication drafting</li>
                <li>Administrative automation</li>
              </ul>
              <p>The AI assistant:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Does not replace professional judgment</li>
                <li>May produce inaccurate or incomplete responses</li>
                <li>Should be reviewed by a responsible adult before implementation</li>
              </ul>
              <p>Braik is not liable for decisions made solely based on AI-generated outputs.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">6. User Content & Uploads</h2>
              <p>Users may upload:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Documents (PDF, Excel, etc.)</li>
                <li>Images</li>
                <li>Schedules</li>
                <li>Playbooks</li>
                <li>Team files</li>
              </ul>
              <p>You retain ownership of your uploaded content.</p>
              <p>By uploading content, you grant Braik a limited license to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Store</li>
                <li>Process</li>
                <li>Analyze (including via AI tools)</li>
                <li>Display within your team environment</li>
              </ul>
              <p>You may not upload unlawful, harmful, or copyrighted material without authorization.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                7. Messaging & Communications
              </h2>
              <p>Braik provides in-platform messaging.</p>
              <p>Users agree not to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Harass or intimidate others</li>
                <li>Share inappropriate content</li>
                <li>Use the platform for unlawful purposes</li>
              </ul>
              <p>Coaches are responsible for moderating team communications.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                8. SMS Terms and Communications Consent
              </h2>
              <p>
                If you provide a mobile phone number and opt in, you agree to receive transactional SMS messages from Braik
                about your account and team participation. These messages may include invitations, scheduling alerts, roster
                updates, and account-related notifications. Message frequency varies by team activity. You can opt out at any
                time by replying STOP to a message. After you opt out, you may miss important team updates unless you rely on
                email or in-app notices.
              </p>
              <p>
                Braik may change, suspend, or discontinue SMS or other messaging features at any time. Carriers are not liable
                for delayed or undelivered messages. Standard message and data rates may apply depending on your mobile plan.
              </p>
              <p>
                You are responsible for providing an accurate mobile number and keeping it up to date. If your number changes,
                update it in your profile so your team can reach you.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                9. Payments & Financial Processing
              </h2>
              <p>Braik may allow coaches to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Connect payment processors</li>
                <li>Collect dues</li>
                <li>Track payments</li>
              </ul>
              <p>
                Braik does not directly store full payment card information. Payments are processed through third-party
                providers.
              </p>
              <p>We are not responsible for disputes between teams and parents regarding fees.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">10. Data Security</h2>
              <p>We implement reasonable administrative and technical safeguards to protect data.</p>
              <p>However:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>No system is completely secure.</li>
                <li>Users acknowledge risk inherent to online services.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">11. Service Availability</h2>
              <p>We strive for uptime and reliability but do not guarantee uninterrupted access.</p>
              <p>We are not liable for downtime due to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Maintenance</li>
                <li>Server issues</li>
                <li>Third-party provider outages</li>
                <li>Force majeure events</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">12. Termination</h2>
              <p>We may suspend or terminate accounts for:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Violating these Terms</li>
                <li>Misuse of platform</li>
                <li>Fraudulent behavior</li>
                <li>Illegal activity</li>
              </ul>
              <p>Users may cancel accounts at any time.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">13. Limitation of Liability</h2>
              <p>To the fullest extent permitted by law:</p>
              <p>Braik and Apex Technical Solutions Group LLC are not liable for:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Indirect damages</li>
                <li>Lost profits</li>
                <li>Coaching outcomes</li>
                <li>Athletic performance results</li>
                <li>Injuries related to sports activities</li>
              </ul>
              <p>Use of the platform is at your own risk.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">14. Governing Law</h2>
              <p>These Terms are governed by the laws of the State of Florida.</p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">15. Contact</h2>
              <p>
                Questions about these Terms or the Braik service:{" "}
                <a href="mailto:support@apextsgroup.com" className="text-[#60A5FA] underline hover:text-slate-100">
                  support@apextsgroup.com
                </a>
              </p>
              <p className="text-sm text-slate-300">Company: Apex Technical Solutions Group LLC</p>
            </div>

            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.terms}
              policyVersion={LEGAL_POLICY_VERSIONS.terms}
            />
          </MarketingLegalDocument>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
