import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { LegalReadTracker } from "@/components/legal-read-tracker"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"

export default function AITransparencyPage() {
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
            AI Transparency
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
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">What AI Does</h2>
              <p>
                Braik AI helps with drafting communications, organizing routine admin tasks, summarizing uploaded files,
                and helping coaches move faster through repetitive operations.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">What AI Does Not Do</h2>
              <p>
                Braik AI does not replace coach judgment, legal guidance, medical guidance, or school policy. AI outputs
                are suggestions and may be incomplete or incorrect.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">Human Responsibility</h2>
              <p>
                A responsible adult must review AI outputs before use, especially when content affects players, families,
                team policy, payments, or scheduling.
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="space-y-2">
              <h2 className="text-xl font-athletic font-semibold uppercase tracking-wide text-[#3B82F6]">
                Data Handling in AI Processing
              </h2>
              <p>
                Files and prompts submitted to AI features are processed to generate responses inside your team workflow.
                Access controls still apply, and teams should only submit content they are authorized to share.
              </p>
            </div>
            <LegalReadTracker
              storageKey={LEGAL_POLICY_REVIEW_KEYS.aiTransparency}
              policyVersion={LEGAL_POLICY_VERSIONS.aiTransparency}
            />
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
