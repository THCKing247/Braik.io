/**
 * Central FAQ entries for marketing site + pricing cross-links.
 * Prefer linking to detailed pages (pricing, AI transparency) over duplicating long copy.
 */

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
      "Braik uses annual program pricing (Head Coach plan or Athletic Director plan). Player accounts are included—players do not pay for their own logins. Use the calculator on the pricing page for a tailored estimate.",
    learnMoreHref: "/pricing#how-much-braik-costs",
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
    answer:
      "Choose your role, create your account, and follow the setup steps. Head coaches configure the program; players and parents can join with codes from the staff. You can import rosters from CSV when you are ready.",
    learnMoreHref: "/signup/role",
    learnMoreLabel: "Start signup",
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
