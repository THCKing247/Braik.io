"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

export function SupportSettings() {
  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Help &amp; Support</CardTitle>
          <CardDescription className="text-muted-foreground">
            Central place for FAQs, policies, and contacting Braik
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The support hub matches what players and parents see in the main menu, plus email contact.
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/dashboard/support">Open support hub</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Quick links</CardTitle>
          <CardDescription className="text-muted-foreground">
            Marketing site pages open in a new tab
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" asChild className="border-border justify-start gap-2 text-foreground">
            <Link href="/faq" target="_blank" rel="noopener noreferrer">
              FAQ
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild className="border-border justify-start gap-2 text-foreground">
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild className="border-border justify-start gap-2 text-foreground">
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild className="border-border justify-start gap-2 text-foreground">
            <Link href="/acceptable-use" target="_blank" rel="noopener noreferrer">
              Acceptable use
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild className="border-border justify-start gap-2 text-foreground">
            <Link href="/ai-transparency" target="_blank" rel="noopener noreferrer">
              AI transparency
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Contact</CardTitle>
          <CardDescription className="text-muted-foreground">
            Account, billing, or product questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="mailto:support@braik.io?subject=Braik%20support%20request"
            className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            support@braik.io
          </a>
          <p className="text-sm text-muted-foreground">
            Include your school or program name and your role. For urgent safety issues, say so in the subject line.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
