"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const FAQ_ITEMS = [
  {
    q: "Is Braik billed monthly or annually?",
    a: "Braik is billed annually. Team programs and the Athletic Department license are both paid once per year, which simplifies budgeting and aligns with typical program planning cycles.",
  },
  {
    q: "Can athletes pay for themselves?",
    a: "Yes. When creating a team program, the head coach can choose \"Players pay individually.\" In that case, the coach pays only the $250 program fee, and each athlete pays $10 when they create their account.",
  },
  {
    q: "Can assistant coaches pay for themselves?",
    a: "Yes. When adding assistant coaches beyond the three included, the head coach can choose whether the program covers the cost or each additional coach pays $10 during signup.",
  },
  {
    q: "What happens if our roster grows?",
    a: "If the coach pays for players, you can add athletes and your next renewal will reflect the updated roster size. If players pay individually, new athletes simply pay $10 when they join. You can adjust your plan at renewal to match your program size.",
  },
  {
    q: "Does the minimum roster size depend on the sport?",
    a: "Yes. Each sport has a minimum roster size (e.g., Football 40, Basketball 10, Soccer 14). The calculator uses these minimums so your estimate matches how Braik will bill your program.",
  },
  {
    q: "What is included in the Athletic Department license?",
    a: "The Athletic Department license ($6,500/year) includes unlimited teams, unlimited athletes, unlimited coaches, an athletic director dashboard, department-wide analytics, and centralized program management—all under one annual payment.",
  },
  {
    q: "Can we start with one team and upgrade later?",
    a: "Yes. Many schools start with a single team program and later upgrade to the Athletic Department license when they want one platform across every sport and centralized visibility.",
  },
] as const

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-2">
          Pricing FAQ
        </h2>
        <p className="text-[#212529]/80">
          Common questions about Braik pricing and billing.
        </p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={item.q}
            className={cn(
              "rounded-xl border-2 border-[#e5e7eb] bg-white overflow-hidden transition-all",
              openIndex === i && "border-[#3B82F6]/40 shadow-md"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-4 px-5 text-left"
            >
              <span className="font-semibold text-[#212529]">{item.q}</span>
              <span
                className={cn(
                  "text-[#3B82F6] text-xl font-bold transition-transform shrink-0",
                  openIndex === i && "rotate-45"
                )}
              >
                +
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                openIndex === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <p className="pb-4 px-5 pt-0 text-[#212529]/85 leading-relaxed border-t border-[#e5e7eb]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
