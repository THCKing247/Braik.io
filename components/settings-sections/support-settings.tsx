"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function SupportSettings() {
  return (
    <div className="space-y-6">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Help & Support</CardTitle>
          <CardDescription className="text-white/70">
            Get help and access support resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-white font-medium mb-2">Documentation</h3>
            <p className="text-sm text-white/60 mb-4">
              Browse our help center for guides and tutorials.
            </p>
            <Link href="/faq">
              <Button variant="outline">View FAQ</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Contact</CardTitle>
          <CardDescription className="text-white/70">
            Reach out to our support team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-white/70">Contact support coming soon</p>
            <p className="text-sm text-white/60">
              You&apos;ll be able to contact our support team directly from here.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Legal</CardTitle>
          <CardDescription className="text-white/70">
            Terms of service and privacy policy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-white/70">Legal documents coming soon</p>
            <p className="text-sm text-white/60">
              View terms of service and privacy policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
