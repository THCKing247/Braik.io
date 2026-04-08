/**
 * Single source of truth for marketing FAQ entries (/faq).
 * Other pages link here instead of duplicating accordions.
 */

import { isWaitlistMode } from "@/lib/config/waitlist-mode"

export type MarketingFaqEntry = {
  id: string
  question: string
  /** Plain-text answer for accordions */
  answer: string
  learnMoreHref?: string
  learnMoreLabel?: string
}

export const MARKETING_FAQ_ENTRIES: MarketingFaqEntry[] = [
  {
    id: "cost",
    question: "How much does Braik cost?",
    answer:
      "Braik uses annual program pricing based on teams, roster size, and optional video add-ons. Guided setup and onboarding are included with every plan. Player accounts are included—players do not pay for their own logins. See the pricing page for line items and example totals.",
    learnMoreHref: "/pricing#core-platform",
    learnMoreLabel: "View pricing details",
  },
  {
    id: "price-factors",
    question: "What determines the price?",
    answer:
      "Your pricing depends on the number of players, the number of teams, and whether you add video.",
    learnMoreHref: "/pricing#core-platform",
    learnMoreLabel: "View pricing details",
  },
  {
    id: "onboarding-required",
    question: "Is onboarding required?",
    answer: "No, but it is recommended for a faster and smoother setup.",
    learnMoreHref: "/pricing#onboarding",
    learnMoreLabel: "Guided setup & onboarding",
  },
  {
    id: "guided-setup-included",
    question: "Is guided setup included?",
    answer:
      "Yes. Every plan includes onboarding support, with flexible options from self-guided setup to team and full program configuration. Additional setup is available on request.",
    learnMoreHref: "/pricing#onboarding",
    learnMoreLabel: "Guided setup & onboarding",
  },
  {
    id: "assistant-coaches-extra",
    question: "Are assistant coaches extra?",
    answer: "Additional coach access is low-cost at $25 per coach.",
    learnMoreHref: "/pricing#core-platform",
    learnMoreLabel: "View pricing details",
  },
  {
    id: "start-one-team",
    question: "Can we start with just one team?",
    answer: "Yes. Many programs start with varsity and add more teams later.",
  },
  {
    id: "enterprise-pricing",
    question: "Do you offer enterprise pricing?",
    answer: "Yes. We offer custom pricing for schools, departments, and larger rollouts.",
  },
  {
    id: "sports",
    question: "What sports are supported?",
    answer:
      "Braik is built for football today—rosters, playbooks, messaging, and operations workflows reflect how football programs run. We may add other sports over time; if you coach another sport, reach out and we can discuss fit.",
  },
  {
    id: "get-started",
    question: "How do I get started?",
    answer: isWaitlistMode()
      ? "Players join with a team join code or QR from their coach—sign up to create an account and link to your roster. Programs opening in phases can join the waitlist for early access; coach and admin accounts stay invite-based."
      : "Players use a team join code or QR from their coach to sign up and join the team. Coach and administrator access is handled separately—use Request access if you need a program account.",
    learnMoreHref: isWaitlistMode() ? "/waitlist" : "/signup/player",
    learnMoreLabel: isWaitlistMode() ? "Join the waitlist" : "Player sign up",
  },
  {
    id: "ai",
    question: "How does Braik use AI?",
    answer:
      "Coach B and related tools help with operational work like drafting communication and organizing information. AI output should always be reviewed before you rely on it in games or with your team.",
    learnMoreHref: "/ai-transparency",
    learnMoreLabel: "AI transparency",
  },
  {
    id: "data-privacy",
    question: "Where are privacy and terms?",
    answer:
      "Our Terms of Service, Privacy Policy, and Acceptable Use Policy explain how accounts, data, and acceptable use work on Braik.",
    learnMoreHref: "/privacy",
    learnMoreLabel: "Privacy policy",
  },
  {
    id: "jv-varsity",
    question: "Does Braik support Varsity and JV?",
    answer:
      "Yes. Programs can run multiple levels (Varsity, JV, and Freshman) under one program structure so staff and families stay aligned without juggling separate apps.",
    learnMoreHref: "/why-braik",
    learnMoreLabel: "Why Braik",
  },
  {
    id: "who-built-for",
    question: "Who is Braik built for?",
    answer:
      "Braik is built for football programs—especially high schools and growing athletic departments—that want one connected system for staff, players, and families without juggling a pile of separate apps.",
  },
  {
    id: "replace-tools",
    question: "Does Braik replace multiple tools?",
    answer:
      "Braik is designed to bring core program operations together—communication, scheduling, rosters, documents, payments, and more—so your staff spends less time switching systems and more time coaching.",
  },
  {
    id: "smaller-staffs",
    question: "Is Braik built for smaller coaching staffs?",
    answer:
      "Yes. Fewer people wearing more hats is the norm. Braik reduces admin overhead and keeps workflows straightforward so small staffs are not buried in software upkeep.",
  },
  {
    id: "grow-over-time",
    question: "Can programs grow into Braik over time?",
    answer:
      "Many teams start focused and add teams, depth, or features as needs change. The platform is built to scale with your program instead of forcing you into a rigid bundle on day one.",
  },
]
