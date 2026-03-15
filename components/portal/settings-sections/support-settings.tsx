"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function SupportSettings() {
  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Help & Support</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get help and access support resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-foreground font-medium mb-2">Documentation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Browse our help center for guides and tutorials.
            </p>
            <Link href="/faq">
              <Button variant="outline" className="border-border text-foreground">View FAQ</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Contact</CardTitle>
          <CardDescription className="text-muted-foreground">
            Reach out to our support team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">Contact support coming soon</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ll be able to contact our support team directly from here.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Legal</CardTitle>
          <CardDescription className="text-muted-foreground">
            Terms of service and privacy policy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">Legal documents coming soon</p>
            <p className="text-sm text-muted-foreground">
              View terms of service and privacy policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
