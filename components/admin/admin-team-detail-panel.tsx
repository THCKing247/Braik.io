import Link from "next/link"
import type { AdminTeamDetailModel } from "@/lib/admin/load-admin-team-detail"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"
import { adminOpsTeamStateChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function AdminTeamDetailPanel({ model }: { model: AdminTeamDetailModel }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/teams" className={cn(adminUi.link, "text-sm underline-offset-2")}>
          ← All teams
        </Link>
      </div>

      <AdminPageHeader
        title={model.name}
        description="Team record and ownership context (read-only fields). Update operational status below when needed."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Overview</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className={adminUi.label}>Team ID</dt>
              <dd className="font-mono text-xs font-medium text-admin-primary">{model.id}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>Plan tier</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.planTier ?? "—"}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>Sport</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.sport ?? "—"}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>Level</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.teamLevel ?? "—"}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>Subscription</dt>
              <dd>
                <span className={cn(adminOpsTeamStateChip(model.subscriptionStatus))}>{model.subscriptionStatus}</span>
              </dd>
            </div>
            <div>
              <dt className={adminUi.label}>Team status</dt>
              <dd>
                <span className={cn(adminOpsTeamStateChip(model.teamStatus))}>{model.teamStatus}</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={adminUi.label}>Created</dt>
              <dd className="text-sm font-medium text-admin-primary">
                {new Date(model.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Operational status</h2>
          <p className="mt-1 text-xs font-medium text-admin-secondary">
            Updates <span className="font-mono text-[11px]">teams.team_status</span> via the live admin route (not Prisma-era
            stubs).
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <AdminTeamStatusForm teamId={model.id} initialStatus={model.teamStatus} />
          </div>
        </section>
      </div>

      <section className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Organization &amp; ownership</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className={adminUi.label}>Owning organization</dt>
            <dd className="text-sm font-semibold text-admin-primary">{model.organization.name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={adminUi.label}>Organization ID</dt>
            <dd className="font-mono text-xs text-admin-secondary">
              {model.organization.id ?? "— (unassigned)"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={adminUi.label}>Ownership resolution</dt>
            <dd className="text-sm font-medium text-admin-secondary">{model.ownershipSummary}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={adminUi.label}>Source key</dt>
            <dd className="font-mono text-[11px] text-admin-muted">{model.ownershipSource}</dd>
          </div>
          {model.programId ? (
            <>
              <div>
                <dt className={adminUi.label}>Program</dt>
                <dd className="text-sm font-medium text-admin-primary">{model.programName ?? "—"}</dd>
              </div>
              <div>
                <dt className={adminUi.label}>Program ID</dt>
                <dd className="font-mono text-xs text-admin-secondary">{model.programId}</dd>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <dt className={adminUi.label}>Program</dt>
              <dd className="text-sm font-medium text-admin-muted">—</dd>
            </div>
          )}
        </dl>
        {model.legacyNotes ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            {model.legacyNotes}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Coaching</h2>
          <dl className="mt-4 grid gap-3">
            <div>
              <dt className={adminUi.label}>Head coach (team_members)</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.headCoachName ?? "—"}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>HC / AC staff count</dt>
              <dd className="text-sm font-medium text-admin-primary tabular-nums">{model.coachStaffCount}</dd>
            </div>
          </dl>
        </section>

        <section className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>School &amp; athletic department</h2>
          <dl className="mt-4 grid gap-3">
            <div>
              <dt className={adminUi.label}>School (team / resolved)</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.schoolDisplay ?? "—"}</dd>
            </div>
            <div>
              <dt className={adminUi.label}>Athletic department</dt>
              <dd className="text-sm font-medium text-admin-primary">{model.athleticDepartmentDisplay ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
