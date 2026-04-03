/**
 * Central FAQ entries for marketing site + pricing cross-links.
 * Prefer linking to detailed pages (pricing, AI transparency) over duplicating long copy.
 */

import { isWaitlistMode } from "@/lib/config/waitlist-mode"

export type MarketingFaqEntry = {
  id: string
  question: string
  /** Plain-text / light HTML-free answer for accordions */
  answer: string
  /** Optional "learn more" link */
  learnMoreHref?: string
  learnMoreLabel?: string
}

export const MARKETING_FAQ_ENTRIES: MarketingFaqEntry[] = [
  {
    id: "cost",
    question: "How much does Braik cost?",
    answer:
      "Braik uses annual program pricing based on teams, roster size, optional video add-ons, and onboarding. Player accounts are included—players do not pay for their own logins. See the pricing page for line items and example totals.",
    learnMoreHref: "/pricing#core-platform",
    learnMoreLabel: "View pricing details",
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
      ? "Braik is opening in phases. Join the waitlist to request early access for your program. Existing teams continue to use invite links and codes from their staff to activate accounts."
      : "Accounts are created by your administrator. Request access and we will route you to the right contact; staff can still invite players and families with secure links and codes.",
    learnMoreHref: isWaitlistMode() ? "/waitlist" : "/request-access",
    learnMoreLabel: isWaitlistMode() ? "Join the waitlist" : "Request access",
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
]
