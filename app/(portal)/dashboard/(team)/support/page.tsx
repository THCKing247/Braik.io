import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail, BookOpen, MessageSquarePlus } from "lucide-react"
import { SupportFeedbackForm } from "@/components/portal/support-feedback-form"
import { PortalStandardPage } from "@/components/portal/portal-standard-page"

/* No force-dynamic: parent dashboard layout is already dynamic (cookies). This page is mostly static UI. */

export default function SupportPage() {
  return (
    <PortalStandardPage
      title="Support"
      description="Send feedback, contact the team, and browse legal links — full help articles are coming soon."
      bodyClassName="min-w-0"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Card className="border min-w-0" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "rgb(var(--text))" }}>
              <MessageSquarePlus className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
              Send feedback
            </CardTitle>
            <CardDescription style={{ color: "rgb(var(--muted))" }}>
              Bug reports, ideas, and questions go to the Braik team with your role and optional team context (no sensitive
              AI prompts are included).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
              <SupportFeedbackForm />
            </Suspense>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "rgb(var(--text))" }}>
                <Mail className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
                Contact
              </CardTitle>
              <CardDescription style={{ color: "rgb(var(--muted))" }}>
                For account, billing, or product questions, email the team. Include your school/program name and role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="mailto:support@apextsgroup.com?subject=Braik%20support%20request"
                className="inline-flex text-sm font-semibold underline-offset-4 hover:underline"
                style={{ color: "rgb(var(--accent))" }}
              >
                support@apextsgroup.com
              </a>
              <p className="mt-3 text-sm" style={{ color: "rgb(var(--muted))" }}>
                Response times are fastest on business days. For urgent safety issues, say so in the subject line.
              </p>
            </CardContent>
          </Card>

          <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "rgb(var(--text))" }}>
                <BookOpen className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
                Help articles
              </CardTitle>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
                Help articles are coming soon and will be available through{" "}
                <a
                  href="https://help.braik.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "rgb(var(--accent))" }}
                >
                  help.braik.io
                </a>
                .
              </p>
              <CardDescription className="pt-1" style={{ color: "rgb(var(--muted))" }}>
                Policies and product guides (opens in a new tab where noted).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="outline" asChild className="border-border justify-start">
                <Link href="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-border justify-start">
                <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-border justify-start">
                <Link href="/acceptable-use" target="_blank" rel="noopener noreferrer">
                  Acceptable use
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-border justify-start">
                <Link href="/ai-transparency" target="_blank" rel="noopener noreferrer">
                  AI transparency
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-border justify-start">
                <Link href="/why-braik" target="_blank" rel="noopener noreferrer">
                  Why Braik
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalStandardPage>
  )
}
