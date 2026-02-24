"use client"

import { useEffect, useRef, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

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
    <div className="min-h-screen text-[#FFFFFF] bg-[#64748B]">
      <SiteHeader />
      
      {/* Features */}
      <section 
        className="relative min-h-screen bg-cover bg-no-repeat"
        style={{
          backgroundImage: 'url(/hero-background.jpg)',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Left-to-right gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#64748B]/70 via-[#64748B]/50 to-[#64748B]/30"></div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h2 className="text-3xl font-athletic font-bold text-center mb-16 text-[#FFFFFF] uppercase tracking-wide drop-shadow-lg">
            Everything your team needs
          </h2>
          <div className="max-w-5xl mx-auto space-y-8">
            {features.map((feature, index) => (
              <div
                key={index}
                ref={(el) => {
                  featureRefs.current[index] = el
                }}
                className={`p-10 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF] transition-all duration-1000 ease-out ${
                  visibleFeatures.has(index)
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
              >
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase">
                  {feature.emoji} {feature.title}
                </h3>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
