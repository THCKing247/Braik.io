const heroValuePills = [
  "One platform for coaches, players, and families",
  "Built for Varsity + JV program structure",
  "Season-based pricing that stays budgetable",
] as const

export function HomeHeroHeadlines() {
  return (
    <div className="space-y-7">
      <h1 className="font-athletic text-5xl font-bold uppercase leading-[0.98] tracking-[-0.02em] text-slate-100 drop-shadow-[0_4px_36px_rgba(0,0,0,0.55)] sm:text-6xl md:text-7xl lg:text-8xl">
        Braik the busywork.
        <br />
        <span className="inline-block bg-gradient-to-r from-blue-200 via-white to-blue-100 bg-clip-text pb-0.5 text-transparent drop-shadow-[0_2px_24px_rgba(59,130,246,0.45)]">
          Run the team.
        </span>
      </h1>
      <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-slate-200 md:text-xl">
        Your AI Operations Coach for Every Season.
        <br />
        <span className="font-semibold text-slate-100 drop-shadow-sm">Braik the Chaos.</span>
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        {heroValuePills.map((pill) => (
          <span
            key={pill}
            className="inline-flex items-center rounded-full border border-white/25 bg-white/[0.08] px-4 py-2 text-sm font-medium text-slate-100 shadow-lg shadow-black/20 ring-1 ring-white/15 backdrop-blur-md"
          >
            {pill}
          </span>
        ))}
      </div>
      <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300">
        <span className="font-semibold text-slate-200">Football-first today</span> — Braik is built around how football
        programs operate. Additional sports may follow as the platform matures.
      </p>
    </div>
  )
}
