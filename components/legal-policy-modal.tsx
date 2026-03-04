"use client"

import { useEffect, useRef, useState } from "react"
import { X, ChevronDown, CheckCircle } from "lucide-react"

// ─── Policy content ───────────────────────────────────────────────────────────

function TermsContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <div className="space-y-1">
        <p className="font-semibold text-[#3B82F6]">TERMS OF SERVICE</p>
        <p>Effective Date: 03/01/2026</p>
        <p>Company: Apex Technical Solutions Group LLC</p>
        <p>Product: Braik</p>
      </div>
      <Section title="1. Acceptance of Terms">
        <p>By accessing or using Braik ("Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform.</p>
        <p>Braik is a sports team management and AI-assisted coordination platform designed for coaches, assistants, players, and parents.</p>
      </Section>
      <Section title="2. Description of Service">
        <p>Braik provides:</p>
        <BulletList items={["Team communication tools","Role-based access controls","AI assistant functionality","Practice and schedule management","File and image uploads","Formation and playbook tools","Payment collection integrations","Administrative automation tools"]} />
        <p>We reserve the right to modify or update features at any time.</p>
      </Section>
      <Section title="3. User Roles & Account Responsibility">
        <p>Users may register under roles including but not limited to:</p>
        <BulletList items={["Head Coach","Assistant Coach","Player","Parent/Guardian","Administrator"]} />
        <p>You are responsible for maintaining account confidentiality, all activity under your login, and ensuring your role assignment is accurate. Head Coaches are responsible for managing their team's user permissions.</p>
      </Section>
      <Section title="4. Youth Protection & Minor Users">
        <p>Braik may be used by minors under supervision of a coach or parent. Users under 18 must have parental or guardian consent. Parents/guardians are responsible for reviewing and approving minor participation.</p>
        <p>Braik does not knowingly collect personal data directly from minors without associated adult oversight. We comply with applicable child data protection laws including COPPA where applicable.</p>
      </Section>
      <Section title="5. AI Assistant Disclaimer">
        <p>Braik includes AI-powered tools to assist with scheduling, practice planning, file interpretation, communication drafting, and administrative automation.</p>
        <p>The AI assistant does not replace professional judgment, may produce inaccurate or incomplete responses, and should be reviewed by a responsible adult before implementation. Braik is not liable for decisions made solely based on AI-generated outputs.</p>
      </Section>
      <Section title="6. User Content & Uploads">
        <p>Users may upload documents, images, schedules, playbooks, and team files. You retain ownership of your uploaded content. By uploading content, you grant Braik a limited license to store, process, analyze (including via AI tools), and display content within your team environment. You may not upload unlawful, harmful, or copyrighted material without authorization.</p>
      </Section>
      <Section title="7. Messaging & Communications">
        <p>Braik provides in-platform messaging. Users agree not to harass or intimidate others, share inappropriate content, or use the platform for unlawful purposes. Coaches are responsible for moderating team communications.</p>
      </Section>
      <Section title="8. Payments & Financial Processing">
        <p>Braik may allow coaches to connect payment processors, collect dues, and track payments. Braik does not directly store full payment card information. Payments are processed through third-party providers. We are not responsible for disputes between teams and parents regarding fees.</p>
      </Section>
      <Section title="9. Data Security">
        <p>We implement reasonable administrative and technical safeguards to protect data. No system is completely secure. Users acknowledge risk inherent to online services.</p>
      </Section>
      <Section title="10. Service Availability">
        <p>We strive for uptime and reliability but do not guarantee uninterrupted access. We are not liable for downtime due to maintenance, server issues, third-party provider outages, or force majeure events.</p>
      </Section>
      <Section title="11. Termination">
        <p>We may suspend or terminate accounts for violating these Terms, misuse of the platform, fraudulent behavior, or illegal activity. Users may cancel accounts at any time.</p>
      </Section>
      <Section title="12. Limitation of Liability">
        <p>To the fullest extent permitted by law, Braik and Apex Technical Solutions Group LLC are not liable for indirect damages, lost profits, coaching outcomes, athletic performance results, or injuries related to sports activities. Use of the platform is at your own risk.</p>
      </Section>
      <Section title="13. Governing Law">
        <p>These Terms are governed by the laws of the State of Florida.</p>
      </Section>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <div className="space-y-1">
        <p className="font-semibold text-[#3B82F6]">PRIVACY POLICY</p>
        <p>Effective Date: 03/01/2026</p>
        <p>Company: Apex Technical Solutions Group LLC</p>
        <p>Product: Braik</p>
      </div>
      <Section title="1. Information We Collect">
        <p className="font-semibold">Account Information</p>
        <BulletList items={["Name","Email address","Role (Coach, Player, Parent)","Team affiliation"]} />
        <p className="font-semibold mt-2">Usage Data</p>
        <BulletList items={["Login activity","Feature interactions","Messaging data","Uploaded content"]} />
        <p className="font-semibold mt-2">Payment Information</p>
        <BulletList items={["Limited billing data via third-party processors"]} />
        <p className="font-semibold mt-2">AI Processing Data</p>
        <BulletList items={["Documents submitted for analysis","Images uploaded for configuration","Practice schedules and spreadsheets"]} />
      </Section>
      <Section title="2. How We Use Information">
        <p>We use data to provide team management services, enable AI functionality, improve platform features, provide customer support, and maintain security. We do not sell personal data.</p>
      </Section>
      <Section title="3. Data Sharing">
        <p>We may share data with payment processors, cloud hosting providers, and to comply with legal obligations. We do not sell or rent user data to advertisers.</p>
      </Section>
      <Section title="4. Data Storage & Retention">
        <p>Data is stored on secure cloud infrastructure. We retain data as long as an account is active, as required for legal compliance, and until a user requests deletion (where applicable).</p>
      </Section>
      <Section title="5. Minor Data Protection">
        <p>For users under 18, data is associated with a parent or coach account. Parents may request review or deletion. We limit exposure of minor data within team environments only.</p>
      </Section>
      <Section title="6. Security Measures">
        <p>We use encrypted connections (HTTPS), role-based access controls, and secure authentication systems. However, no system is 100% secure.</p>
      </Section>
      <Section title="7. User Rights">
        <p>Users may request data deletion, update account information, and request a copy of stored personal data. Contact: info@apextsgroup.com</p>
      </Section>
      <Section title="8. Cookies & Tracking">
        <p>Braik may use session cookies, authentication tokens, and basic analytics tools. We do not use invasive third-party advertising trackers.</p>
      </Section>
      <Section title="9. Changes to Policy">
        <p>We may update this Privacy Policy periodically. Continued use constitutes acceptance.</p>
      </Section>
    </div>
  )
}

function AcceptableUseContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <p className="font-semibold text-[#3B82F6]">BRAIK ACCEPTABLE USE POLICY</p>
      <p>Braik is built to support coaches, players, and families with clear communication and organized team operations. To protect that environment, all users must follow this policy.</p>
      <div className="h-px bg-[#E5E7EB]" />
      <Section title="Allowed Use">
        <p>Use Braik for team operations, scheduling, documents, messaging, payments, and approved coaching workflows.</p>
      </Section>
      <Section title="Prohibited Use">
        <BulletList items={["Harassment, bullying, intimidation, or discriminatory behavior","Uploading harmful, malicious, unlawful, or unauthorized copyrighted content","Misuse of team data, player data, or minor information","Credential sharing, impersonation, or unauthorized access attempts","Using AI tools for deceptive or unsafe instructions"]} />
      </Section>
      <Section title="Coaches & Staff">
        <p>Coaches and staff are responsible for setting communication expectations, moderating team channels, and enforcing safe usage standards.</p>
      </Section>
      <Section title="Enforcement">
        <p>Violations may result in warning, feature restrictions, suspension, or account termination. Serious or repeated violations may be escalated immediately.</p>
      </Section>
    </div>
  )
}

function AITransparencyContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <p className="font-semibold text-[#3B82F6]">BRAIK AI TRANSPARENCY & ACKNOWLEDGEMENT</p>
      <Section title="What AI Does">
        <p>Braik AI helps with drafting communications, organizing routine admin tasks, summarizing uploaded files, and helping coaches move faster through repetitive operations.</p>
      </Section>
      <div className="h-px bg-[#E5E7EB]" />
      <Section title="What AI Does Not Do">
        <p>Braik AI does not replace coach judgment, legal guidance, medical guidance, or school policy. AI outputs are suggestions and may be incomplete or incorrect.</p>
      </Section>
      <div className="h-px bg-[#E5E7EB]" />
      <Section title="Human Responsibility">
        <p>A responsible adult must review AI outputs before use, especially when content affects players, families, team policy, payments, or scheduling.</p>
      </Section>
      <div className="h-px bg-[#E5E7EB]" />
      <Section title="Data Handling in AI Processing">
        <p>Files and prompts submitted to AI features are processed to generate responses inside your team workflow. Access controls still apply, and teams should only submit content they are authorized to share.</p>
      </Section>
      <div className="h-px bg-[#E5E7EB]" />
      <Section title="Your Acknowledgement">
        <p>By closing this modal you confirm that you understand AI-powered tools are included in Braik, that AI-generated outputs must be reviewed by a responsible party before implementation, and that Braik is not liable for decisions made solely on the basis of AI-generated content.</p>
      </Section>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[#212529]">{title}</h3>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-[#495057]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

// ─── Policy config ─────────────────────────────────────────────────────────────

export type PolicyKey = "terms" | "privacy" | "acceptableUse" | "ai"

const POLICIES: Record<PolicyKey, { title: string; content: React.ReactNode }> = {
  terms: {
    title: "Terms of Service",
    content: <TermsContent />,
  },
  privacy: {
    title: "Privacy Policy",
    content: <PrivacyContent />,
  },
  acceptableUse: {
    title: "Acceptable Use Policy",
    content: <AcceptableUseContent />,
  },
  ai: {
    title: "AI Transparency & Acknowledgement",
    content: <AITransparencyContent />,
  },
}

// ─── Main modal component ──────────────────────────────────────────────────────

interface LegalPolicyModalProps {
  /** Which policy to display */
  policyKey: PolicyKey
  /** Whether the modal is open */
  isOpen: boolean
  /**
   * Called when the user closes the modal.
   * `accepted` is true only when they scrolled to the bottom first.
   */
  onClose: (accepted: boolean) => void
}

export function LegalPolicyModal({ policyKey, isOpen, onClose }: LegalPolicyModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasRead, setHasRead] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)

  // Reset read state whenever a new policy is opened, then immediately check
  // whether the content is short enough that no scrolling is required.
  useEffect(() => {
    if (!isOpen) return

    setHasRead(false)
    setScrollPct(0)

    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }

    // After the browser has painted the modal content, check if a scrollbar
    // is even present. If the entire policy fits without scrolling, consider
    // it fully read straight away so the accept button is immediately active.
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      if (el.scrollHeight <= el.clientHeight) {
        setHasRead(true)
        setScrollPct(1)
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [isOpen, policyKey])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  // Prevent background scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const pct = (el.scrollTop + el.clientHeight) / Math.max(el.scrollHeight, 1)
    setScrollPct(pct)
    if (pct >= 0.92) {
      setHasRead(true)
    }
  }

  const handleAcceptAndClose = () => {
    onClose(true)
  }

  const handleDismiss = () => {
    onClose(false)
  }

  if (!isOpen) return null

  const policy = POLICIES[policyKey]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 cursor-default"
        onClick={handleDismiss}
        aria-label="Close policy modal"
        tabIndex={-1}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white shadow-2xl border border-[#E5E7EB] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={policy.title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white shrink-0">
          <div>
            <p className="text-xs font-semibold text-[#3B82F6] uppercase tracking-widest mb-0.5">
              Read Before Accepting
            </p>
            <h2 className="text-lg font-athletic font-bold text-[#212529] uppercase tracking-tight">
              {policy.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-[#6c757d] hover:bg-[#F9FAFB] hover:text-[#212529] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scroll progress bar */}
        <div className="h-1 bg-[#E5E7EB] shrink-0">
          <div
            className="h-full bg-[#3B82F6] transition-all duration-150"
            style={{ width: `${Math.min(scrollPct * 100, 100).toFixed(1)}%` }}
          />
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-6 text-[#495057]"
        >
          {policy.content}

          {/* Bottom padding sentinel so last line is clearly readable before the footer */}
          <div className="h-8" />
        </div>

        {/* Scroll-to-read hint — shown while not yet read */}
        {!hasRead && (
          <div className="shrink-0 flex items-center justify-center gap-1.5 py-2 bg-[#F9FAFB] border-t border-[#E5E7EB] text-xs text-[#9CA3AF] select-none">
            <ChevronDown size={14} className="animate-bounce" />
            Scroll to the bottom to accept
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-[#E5E7EB] bg-white flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-[#6c757d] hover:text-[#212529] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAcceptAndClose}
            disabled={!hasRead}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
              hasRead
                ? "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-sm"
                : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
            }`}
          >
            {hasRead && <CheckCircle size={16} />}
            {hasRead ? "I have read & accept" : "Read to the bottom to accept"}
          </button>
        </div>
      </div>
    </div>
  )
}
