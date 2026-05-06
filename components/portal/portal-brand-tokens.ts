export const braikBrand = {
  navy: {
    900: "#081848",
    950: "#081838",
  },
  orange: {
    500: "#F85808",
    700: "#D83808",
  },
  white: {
    50: "#F8F8F8",
    100: "#F8F8E8",
  },
} as const

export const braikPortalTheme = {
  shell: "bg-[#081838] bg-gradient-to-b from-[#081848] via-[#081838] to-[#050f2f]",
  header: "border-[#1f2f63] bg-[#081838]/97",
  nav: "border-[#2a3a70] bg-[#060f2d]/99",
  textPrimary: "text-[#F8F8F8]",
  textWarm: "text-[#F8F8E8]",
  textSecondary: "text-[#c6cfe4]",
  textMuted: "text-[#9aa8c7]",
  surface: "border-[#1f2f63] bg-[#0a1e56]",
  surfaceSoft: "border-[#223770] bg-[#0f2768]",
  cardDark: "border-[#1f2f63] bg-[#0a1e56]",
  badgeDark: "bg-[#10265f] text-[#F8F8F8]",
  accentText: "text-[#F85808]",
  accentTextHover: "hover:text-[#D83808]",
  accentBg: "bg-[#F85808]",
  accentBgHover: "hover:bg-[#D83808]",
  accentRing: "ring-[#F85808]/55",
  activeTab: "bg-[#F85808] text-[#F8F8F8] shadow-lg shadow-[#D83808]/35 ring-1 ring-[#F85808]/65",
  inactiveTab: "text-[#d2dbec] hover:bg-[#10265f]",
  heroBadge: "bg-gradient-to-br from-[#F85808] to-[#D83808] text-[#F8F8F8]",
} as const

export const braikPlayerTheme = {
  ...braikPortalTheme,
  // Player keeps stronger orange energy.
  surface: "border-[#2a3152] bg-[#0c1739]",
  surfaceSoft: "border-[#2a3152] bg-[#101f4d]",
  cardDark: "border-[#2a3152] bg-[#0c1739]",
  activeTab: "bg-[#F85808] text-[#F8F8F8] shadow-lg shadow-[#D83808]/45 ring-1 ring-[#F85808]/70",
  heroBadge: "bg-gradient-to-br from-[#F85808] via-[#F85808] to-[#D83808] text-[#F8F8F8]",
} as const

export const braikParentTheme = {
  ...braikPortalTheme,
  // Parent keeps calmer navy dominance.
  surface: "border-[#1d2f61] bg-[#0b1d4e]",
  surfaceSoft: "border-[#1d2f61] bg-[#10275f]",
  cardDark: "border-[#1d2f61] bg-[#0b1d4e]",
  activeTab: "bg-[#F85808] text-[#F8F8F8] shadow-md shadow-[#D83808]/30 ring-1 ring-[#F85808]/60",
} as const
