import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { LegalReadTracker } from "@/components/marketing/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import {
  MarketingHeroBlobs,
  MarketingLegalDocument,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function AITransparencyPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-14 md:py-20">
        <MarketingHeroBlobs />
        <div className={`${marketingSectionShell} relative z-10`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-center mb-10 md:mb-12 text-[#212529] uppercase tracking-tight">
            AI Transparency
          </h1>
          <MarketingLegalDocument>
            <div className="space-y-2">
              <h2>What AI Does</h2>
              <p>
                Braik AI helps with drafting communications, organizing routine admin tasks, summarizing uploaded files,
                and helping coaches move faster through repetitive operations.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2>What AI Does Not Do</h2>
              <p>
                Braik AI does not replace coach judgment, legal guidance, medical guidance, or school policy. AI outputs
                are suggestions and may be incomplete or incorrect.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2>Human Responsibility</h2>
              <p>
                A responsible adult must review AI outputs before use, especially when content affects players, families,
                team policy, payments, or scheduling.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2>Data Handling in AI Processing</h2>
              <p>
                Files and prompts submitted to AI features are processed to generate responses inside your team workflow.
                Access controls still apply, and teams should only submit content they are authorized to share.
              </p>
            </div>
            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.aiTransparency}
              policyVersion={LEGAL_POLICY_VERSIONS.aiTransparency}
            />
          </MarketingLegalDocument>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
