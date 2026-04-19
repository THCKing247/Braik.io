/**
 * Curated Unsplash imagery for the Apex Showroom demo (presentation-only).
 * Stable photo IDs — swap URLs if licenses change.
 */

export const showroomHero = {
  src: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=82",
  alt: "Modern glass architecture against sky — conceptual headquarters visual",
  width: 2000,
  height: 1333,
} as const

export const showroomWorkspace = {
  src: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=82",
  alt: "Bright open office workspace",
  width: 2000,
  height: 1333,
} as const

/** “Before” — neutral baseline interior */
export const compareBefore = {
  src: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=2000&q=82",
  alt: "Baseline workspace interior",
} as const

/** “After” — refined lighting and atmosphere */
export const compareAfter = {
  src: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?auto=format&fit=crop&w=2000&q=82",
  alt: "Elevated lobby with warm lighting",
} as const

export const industryCards = [
  {
    id: "enterprise",
    title: "Enterprise IT",
    tagline: "Governed rollouts & observability",
    src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=82",
    alt: "Server room corridor",
    detail:
      "Blueprint staging, audit trails, and executive-ready dashboards — tuned for regulated environments without slowing delivery.",
  },
  {
    id: "critical",
    title: "Critical infrastructure",
    tagline: "Resilience under pressure",
    src: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=82",
    alt: "Industrial wind turbines at dusk",
    detail:
      "Failure-isolated architectures, operational playbooks, and always-on monitoring patterns built for teams who cannot afford downtime.",
  },
  {
    id: "experience",
    title: "Digital experience",
    tagline: "Premium surface, disciplined delivery",
    src: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=82",
    alt: "Hands on laptop with colorful interface glow",
    detail:
      "Motion-forward interfaces with tokenized systems — designers and engineers ship together with shared primitives and measurable UX.",
  },
  {
    id: "growth",
    title: "Growth & ventures",
    tagline: "Ship fast without losing taste",
    src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=82",
    alt: "Team collaboration at a whiteboard",
    detail:
      "Experiment-friendly stacks with guardrails: feature flags, cohort analytics, and narrative-ready reporting for stakeholders.",
  },
] as const

export const layoutMockA = {
  src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=82",
  alt: "Analytics dashboard abstract",
} as const

export const layoutMockB = {
  src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=82",
  alt: "Data visualization on screen",
} as const
