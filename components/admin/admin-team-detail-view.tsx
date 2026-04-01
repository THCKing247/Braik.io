import Link from "next/link"
import type { AdminTeamDetail } from "@/lib/admin/admin-team-detail"
import { AdminTeamDetailActions } from "@/components/admin/admin-team-detail-actions"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"

function statusChip(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  if (normalized === "suspended" || normalized === "terminated") return "bg-red-500/20 text-red-200 border-red-400/40"
  if (normalized === "grace_period" || normalized === "past_due") return "bg-orange-500/20 text-orange-200 border-orange-400/40"
  if (normalized === "cancelled") return "bg-[#000000]/20 text-[#e5e7eb] border-[#000000]/40"
  return "bg-white/10 text-white/80 border-white/20"
}

export function AdminTeamDetailView({ detail }: { detail: AdminTeamDetail }) {
  const videoNote =
    detail.videoEffectiveBlockReason === "organization"
      ? "Organization-level video access is off."
      : detail.videoEffectiveBlockReason === "school"
        ? "School (athletic department) video is off."
        : detail.videoEffectiveBlockReason === "team"
          ? "Team video toggle is off."
          : null

  return (
    <div className="space-y-6 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-white/60">
            <Link href="/admin/teams" className="text-cyan-300/90 underline hover:text-cyan-200">
              Teams
            </Link>
            <span className="text-white/40"> / </span>
            <span className="text-white/80">{detail.name}</span>
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{detail.name}</h1>
          <p className="mt-1 text-sm text-white/70">
            {detail.sport ?? "—"} · {detail.teamLevel ?? "—"} · Plan: {detail.planTier ?? "starter"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(detail.subscriptionStatus)}`}>
              subscription: {detail.subscriptionStatus}
            </span>
            <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(detail.teamStatus)}`}>
              team: {detail.teamStatus}
            </span>
          </div>
        </div>
        <AdminTeamStatusForm teamId={detail.id} initialStatus={detail.teamStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
          <h2 className="text-sm font-semibold text-white/90">Program and organization</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Organization</dt>
              <dd className="text-right text-white/90">{detail.organizationName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Program ID</dt>
              <dd className="font-mono text-xs text-white/80">{detail.programId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Organization ID</dt>
              <dd className="font-mono text-xs text-white/80">{detail.organizationId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">School</dt>
              <dd className="text-right text-white/90">{detail.schoolName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Athletic department</dt>
              <dd className="text-right">
                {detail.resolvedAthleticDepartmentId ? (
                  <Link
                    href={`/admin/athletic-departments/${detail.resolvedAthleticDepartmentId}`}
                    className="text-cyan-300 underline hover:text-cyan-200"
                  >
                    Open department
                  </Link>
                ) : (
                  <span className="text-white/70">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Team athletic_department_id</dt>
              <dd className="font-mono text-xs text-white/80">{detail.athleticDepartmentId ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
          <h2 className="text-sm font-semibold text-white/90">Video / product flags</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Team video</dt>
              <dd>{detail.videoClipsEnabled ? "On" : "Off"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Organization video</dt>
              <dd>
                {detail.organizationVideoEnabled == null ? "—" : detail.organizationVideoEnabled ? "On" : "Off"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Effective (with school/org gates)</dt>
              <dd>{detail.videoEffectiveEnabled ? "Enabled" : "Blocked"}</dd>
            </div>
            {videoNote ? <p className="text-xs text-amber-200/90">{videoNote}</p> : null}
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h2 className="text-sm font-semibold text-white/90">Coaching staff</h2>
        <p className="mt-1 text-xs text-white/55">
          Head coach: <span className="text-white/85">{detail.headCoachName ?? "—"}</span>
          {detail.headCoachUserId ? (
            <span className="ml-2 font-mono text-[11px] text-white/45">({detail.headCoachUserId})</span>
          ) : null}
        </p>
        {detail.staff.length === 0 ? (
          <p className="mt-2 text-sm text-white/55">No staff rows on this team (or only players/parents).</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 text-sm">
            {detail.staff.map((s) => (
              <li key={s.userId} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-white/90">{s.name ?? "(no name)"}</span>
                <span className="text-white/55">{s.role ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-white/90">Admin actions</h2>
        <AdminTeamDetailActions
          team={{
            id: detail.id,
            name: detail.name,
            subscriptionStatus: detail.subscriptionStatus,
            teamStatus: detail.teamStatus,
            baseAiCredits: detail.baseAiCredits,
            aiUsageThisCycle: detail.aiUsageThisCycle,
            aiEnabled: detail.aiEnabled,
            aiDisabledByPlatform: detail.aiDisabledByPlatform,
          }}
        />
      </div>
    </div>
  )
}
