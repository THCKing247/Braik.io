"use client"

import { useEffect, useState } from "react"

type Countdown = { dd: string; hh: string; mm: string; ss: string }

function pad(v: number) {
  return String(v).padStart(2, "0")
}

function nextGameKickoff(): Date {
  const now = new Date()
  const d = new Date(now)
  // next Friday 7 PM local
  const daysUntilFriday = (5 - now.getDay() + 7) % 7
  d.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday))
  d.setHours(19, 0, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 7)
  return d
}

function useCountdown(target: Date): Countdown {
  const compute = (): Countdown => {
    let ms = target.getTime() - Date.now()
    if (ms < 0) ms = 0
    const s = Math.floor(ms / 1000)
    return {
      dd: pad(Math.floor(s / 86400)),
      hh: pad(Math.floor((s % 86400) / 3600)),
      mm: pad(Math.floor((s % 3600) / 60)),
      ss: pad(s % 60),
    }
  }

  const [cd, setCd] = useState<Countdown>(compute)

  useEffect(() => {
    const id = setInterval(() => setCd(compute()), 1000)
    return () => clearInterval(id)
  }, [target])

  return cd
}

type PlayerTeamHeroProps = {
  firstName: string
  teamName: string
  sport?: string | null
  basePath: string
}

export function PlayerTeamHero({ teamName, basePath }: PlayerTeamHeroProps) {
  const kickoff = nextGameKickoff()
  const cd = useCountdown(kickoff)
  const [going, setGoing] = useState(false)
  const [goingCount, setGoingCount] = useState(31)

  const handleRsvp = () => {
    setGoing((prev) => {
      const next = !prev
      setGoingCount(next ? 32 : 31)
      return next
    })
  }

  void basePath

  return (
    <section
      className="relative mb-[14px] overflow-hidden rounded-[24px] border border-[rgba(255,140,70,0.35)] p-[16px_16px_14px]"
      style={{
        background:
          "radial-gradient(420px 210px at 88% -20%, rgba(255,122,51,0.32), transparent 60%)," +
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 34px)," +
          "linear-gradient(135deg,#16307A 0%,#0B1B4A 55%,#081231 100%)",
        boxShadow: "0 22px 60px -28px rgba(255,100,40,0.45)",
      }}
    >
      {/* top row: live chip + eyebrow */}
      <div className="mb-[12px] flex items-center justify-between">
        <span
          className="inline-flex items-center gap-[6px] rounded-[7px] px-[9px] py-[4px] font-black text-[9px] uppercase tracking-[0.1em] text-white"
          style={{ background: "linear-gradient(90deg,#FF3D1F,#FF7A33)" }}
        >
          <span
            className="h-[6px] w-[6px] animate-pulse rounded-full bg-white"
            style={{ animationDuration: "1.6s" }}
          />
          Gameday · Friday
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
          Semifinal → Final
        </span>
      </div>

      {/* matchup */}
      <div className="mb-[14px] flex items-center justify-between px-[6px]">
        <div className="flex w-[88px] flex-col items-center gap-[7px]">
          <div
            className="flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border border-white/[0.16] font-black text-[19px] text-[#160A02]"
            style={{ background: "linear-gradient(140deg,#FF7A33,#FF3D1F)" }}
          >
            {teamName?.slice(0, 3).toUpperCase() || "TST"}
          </div>
          <span className="font-black text-[12px] uppercase tracking-[0.05em] text-[#EEF3FF]">
            {teamName?.split(" ")[0] || "Testers"}
          </span>
          <span className="text-[10px] font-semibold text-[#92A5CC]">8 – 1</span>
        </div>
        <span
          className="font-black text-[26px] text-[rgba(238,243,255,0.28)]"
          style={{ transform: "skewX(-8deg)" }}
        >
          VS
        </span>
        <div className="flex w-[88px] flex-col items-center gap-[7px]">
          <div
            className="flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border border-white/[0.16] font-black text-[19px] text-[#BFD4FF]"
            style={{ background: "linear-gradient(140deg,#20408C,#0F2358)" }}
          >
            CE
          </div>
          <span className="font-black text-[12px] uppercase tracking-[0.05em] text-[#EEF3FF]">
            Central Eagles
          </span>
          <span className="text-[10px] font-semibold text-[#92A5CC]">7 – 2</span>
        </div>
      </div>

      {/* countdown */}
      <div className="mb-[13px] flex gap-[8px] justify-center">
        {([
          { val: cd.dd, label: "DAYS" },
          { val: cd.hh, label: "HRS" },
          { val: cd.mm, label: "MIN" },
          { val: cd.ss, label: "SEC" },
        ] as const).map(({ val, label }) => (
          <div
            key={label}
            className="flex max-w-[74px] flex-1 flex-col items-center rounded-[13px] border border-[rgba(140,170,255,0.16)] bg-[rgba(3,8,26,0.55)] pb-[6px] pt-[8px]"
          >
            <span
              className="block font-black text-[22px] leading-none text-[#EEF3FF]"
              style={{ transform: "skewX(-6deg)" }}
            >
              {val}
            </span>
            <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#92A5CC]">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* footer: venue + facepile + rsvp */}
      <div className="flex items-center gap-[10px]">
        <p className="flex-1 text-[11.5px] font-medium leading-[1.45] text-[#92A5CC]">
          Kickoff 7:00 PM · Carver Field
          <br />
          Home · Gates open 5:30
        </p>
        <div className="flex items-center">
          {["#2C4E9E", "#1E6FD9", "#7A4AE0"].map((c, i) => (
            <span
              key={i}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#0B1B4A] text-[8px] font-black text-white"
              style={{ background: c, marginLeft: i === 0 ? 0 : -7 }}
            >
              {["JR", "MT", "DK"][i]}
            </span>
          ))}
          <span className="ml-[6px] text-[10.5px] font-semibold text-[#92A5CC]">
            {goingCount} going
          </span>
        </div>
        <button
          type="button"
          onClick={handleRsvp}
          className="rounded-[14px] border-none px-[16px] py-[11px] font-bold text-[13px] transition-transform active:scale-[0.96]"
          style={
            going
              ? {
                  background: "linear-gradient(90deg,#2BD576,#17A85A)",
                  color: "#03210F",
                  boxShadow: "0 10px 24px -8px rgba(43,213,118,0.65)",
                }
              : {
                  background: "linear-gradient(90deg,#FF7A33,#FF3D1F)",
                  color: "#160A02",
                  boxShadow: "0 10px 24px -8px rgba(255,90,30,0.65)",
                }
          }
        >
          {going ? "You're going ✓" : "I'm going"}
        </button>
      </div>
    </section>
  )
}
