"use client"

import type { TeamTrendsSnapshot } from "@/lib/schedule-team-trends"

function TrendCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 shadow-sm"
      style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: "rgb(var(--text))" }}>
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "rgb(var(--muted))" }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

export function ScheduleTeamTrendsStrip({ trends }: { trends: TeamTrendsSnapshot }) {
  return (
    <div
      className="mb-6 rounded-xl border p-4 shadow-sm"
      style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
        Team trends
      </h2>
      <p className="mt-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
        Completed games only · {trends.completedCount} final · {trends.upcomingCount} upcoming
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <TrendCard label="Record" value={trends.recordLabel} />
        <TrendCard
          label="Avg scored"
          value={trends.avgPointsScored != null ? String(trends.avgPointsScored) : "—"}
        />
        <TrendCard
          label="Avg allowed"
          value={trends.avgPointsAllowed != null ? String(trends.avgPointsAllowed) : "—"}
        />
        <TrendCard
          label="Pt diff (avg)"
          value={trends.avgPointDiff != null ? (trends.avgPointDiff > 0 ? `+${trends.avgPointDiff}` : String(trends.avgPointDiff)) : "—"}
        />
        <TrendCard label="Streak" value={trends.streakLabel} />
        <TrendCard label="Home / Away" value={`${trends.homeRecordLabel} · ${trends.awayRecordLabel}`} sub="W-L(-T)" />
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "rgb(var(--text2))" }}>
        <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
          Last 3:
        </span>{" "}
        {trends.lastThreeSummary}
      </p>
      {(trends.highestScoringGame || trends.lowestScoringGame) && (
        <div className="mt-2 flex flex-col gap-1 text-[11px] sm:flex-row sm:gap-4" style={{ color: "rgb(var(--muted))" }}>
          {trends.highestScoringGame ? (
            <span>
              High: {trends.highestScoringGame.ourScore} pts vs {trends.highestScoringGame.opponent}
            </span>
          ) : null}
          {trends.lowestScoringGame ? (
            <span>
              Low: {trends.lowestScoringGame.ourScore} pts vs {trends.lowestScoringGame.opponent}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
