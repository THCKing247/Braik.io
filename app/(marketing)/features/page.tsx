"use client"

import { useEffect, useRef, useState } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MarketingHeroBlobs } from "@/components/marketing/marketing-page"

export default function FeaturesPage() {
  const [visibleFeatures, setVisibleFeatures] = useState<Set<number>>(new Set())
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    featureRefs.current.forEach((ref, index) => {
      if (!ref) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleFeatures((prev) => new Set([...prev, index]))
              // Disconnect after animation triggers to ensure it only animates once
              observer.disconnect()
            }
          })
        },
        { threshold: 0.2, rootMargin: "0px 0px -50px 0px" }
      )

      observer.observe(ref)
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [])

  const features = [
    {
      title: "Roster Management",
      description: "Track players, positions, and status. Import via CSV, manage season rollovers, and filter by position groups.",
      emoji: "👥"
    },
    {
      title: "Schedule & Calendar",
      description: "Calendar for practices, games, and meetings. Players RSVP availability. Color-coded event types with custom settings.",
      emoji: "📅"
    },
    {
      title: "Digital Dues",
      description: "Season-based pricing with Stripe integration. Parents pay digitally. Track payment status with detailed exports.",
      emoji: "💳"
    },
    {
      title: "Coach-Collected Payments",
      description: "Track custom fees for gear, camps, and fundraisers. Separate from season dues with detailed transaction history.",
      emoji: "💰"
    },
    {
      title: "Announcements",
      description: "Targeted messaging to coaches, players, or parents. Role-based visibility ensures the right people see the right updates.",
      emoji: "📢"
    },
    {
      title: "Document Hub",
      description: "Upload playbooks, waivers, and policies. Role-based visibility with acknowledgement tracking for important documents.",
      emoji: "📄"
    },
    {
      title: "Equipment Inventory",
      description: "Track team equipment, assign items to players, and monitor condition. Know what you have and where it is.",
      emoji: "🎒"
    },
    {
      title: "Team Invites",
      description: "Invite coaches, players, and parents with role-based access. Bulk invite support for faster onboarding.",
      emoji: "✉️"
    },
    {
      title: "AI Assistant",
      description: "Draft messages, summarize content, and flag unpaid dues. Your operations assistant that saves time on routine tasks.",
      emoji: "🤖"
    },
    {
      title: "Team Settings",
      description: "Customize team colors, logos, and branding. Manage calendar settings and assistant coach permissions.",
      emoji: "⚙️"
    },
    {
      title: "Role-Based Access",
      description: "Head coaches, assistants, players, and parents see only what they need. Secure permissions keep data organized.",
      emoji: "🔐"
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      
      {/* Features */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-14 md:py-20">
        <MarketingHeroBlobs />

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-12 text-[#212529] uppercase tracking-tight">
            Everything your team needs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                ref={(el) => {
                  featureRefs.current[index] = el
                }}
                className={`bg-neutral-900 rounded-2xl p-6 shadow-md border border-white/5 transition-all duration-700 ease-out hover:shadow-lg hover:-translate-y-0.5 ${
                  visibleFeatures.has(index) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <div className="max-w-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-semibold text-white font-athletic uppercase tracking-wide text-base">
                    <span aria-hidden className="text-lg leading-none shrink-0">
                      {feature.emoji}
                    </span>
                    <span>{feature.title}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
