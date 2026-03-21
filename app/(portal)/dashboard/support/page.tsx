import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LifeBuoy, Mail, BookOpen, MessageSquarePlus } from "lucide-react"
import { SupportFeedbackForm } from "@/components/portal/support-feedback-form"

export const dynamic = "force-dynamic"

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgb(var(--platinum))" }}
        >
          <LifeBuoy className="h-6 w-6" style={{ color: "rgb(var(--accent))" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>
            Support
          </h1>
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            Help articles and how to reach the Braik team
          </p>
        </div>
      </div>

      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "rgb(var(--text))" }}>
            <BookOpen className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            Help articles
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
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

      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
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
            href="mailto:support@braik.io?subject=Braik%20support%20request"
            className="inline-flex text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: "rgb(var(--accent))" }}
          >
            support@braik.io
          </a>
          <p className="mt-3 text-sm" style={{ color: "rgb(var(--muted))" }}>
            Response times are fastest on business days. For urgent safety issues, say so in the subject line.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
