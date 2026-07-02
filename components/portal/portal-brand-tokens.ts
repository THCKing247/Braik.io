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

/** Spec palette for the player/parent "sports social" redesign */
export const braikSocialTokens = {
  midnight: "#060D22",
  turf: "#0E1B3E",
  turfHi: "#13234E",
  braik: "#FF7A33",
  flame: "#FF3D1F",
  sky: "#4D9BFF",
  win: "#2BD576",
  gold: "#FFC63D",
  chalk: "#EEF3FF",
  steel: "#92A5CC",
  line: "rgba(125,155,255,0.14)",
  dark: "#160A02",
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
  // Player "sports social" redesign — midnight/turf palette, braik orange + flame accents.
  shell: "bg-[#060D22]",
  header: "border-[rgba(125,155,255,0.14)] bg-[#060D22]/95",
  nav: "border-[rgba(125,155,255,0.14)] bg-[#060D22]/82",
  surface: "border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E]",
  surfaceSoft: "border-[rgba(125,155,255,0.14)] bg-[#13234E]",
  cardDark: "border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E]",
  badgeDark: "bg-[#13234E] text-[#EEF3FF]",
  textPrimary: "text-[#EEF3FF]",
  textWarm: "text-[#EEF3FF]",
  textSecondary: "text-[#92A5CC]",
  textMuted: "text-[#92A5CC]",
  accentText: "text-[#FF7A33]",
  accentTextHover: "hover:text-[#FF3D1F]",
  accentBg: "bg-[#FF7A33]",
  accentBgHover: "hover:bg-[#FF3D1F]",
  accentRing: "ring-[#FF7A33]/55",
  activeTab: "bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F] text-[#160A02] shadow-[0_8px_20px_-6px_rgba(255,90,30,0.7)]",
  inactiveTab: "text-[#92A5CC] hover:bg-white/5",
  heroBadge: "bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F] text-[#160A02]",
} as const

export const braikParentTheme = {
  ...braikPortalTheme,
  // Parent keeps calmer navy dominance.
  surface: "border-[#1d2f61] bg-[#0b1d4e]",
  surfaceSoft: "border-[#1d2f61] bg-[#10275f]",
  cardDark: "border-[#1d2f61] bg-[#0b1d4e]",
  activeTab: "bg-[#F85808] text-[#F8F8F8] shadow-md shadow-[#D83808]/30 ring-1 ring-[#F85808]/60",
} as const
