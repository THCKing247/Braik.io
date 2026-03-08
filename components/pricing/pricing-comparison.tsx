"use client"

import { cn } from "@/lib/utils"

const comparison = [
  {
    title: "Team Program",
    description: "Designed for single teams and coaches getting started.",
    points: [
      "Designed for single teams",
      "Flexible athlete payment options",
      "Scalable as programs grow",
    ],
  },
  {
    title: "Athletic Department",
    description: "Designed for full school adoption.",
    points: [
      "Unlimited teams and athletes",
      "Centralized administration",
      "Athletic director dashboard",
    ],
  },
] as const

export function PricingComparison() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-2">
          Choose the right fit for your program
        </h2>
        <p className="text-[#212529]/80 max-w-2xl mx-auto">
          Schools can start with a single team and upgrade to an Athletic Department license later.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {comparison.map((item) => (
          <div
            key={item.title}
            className={cn(
              "rounded-[14px] p-8 border-2 border-[#e5e7eb] bg-white",
              "shadow-sm hover:shadow-md hover:border-[#3B82F6]/30 transition-all"
            )}
          >
            <h3 className="text-xl font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-2">
              {item.title}
            </h3>
            <p className="text-[#212529]/80 mb-6 leading-relaxed">
              {item.description}
            </p>
            <ul className="space-y-2">
              {item.points.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-2 text-[#212529]"
                >
                  <span className="text-[#3B82F6] font-bold">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
