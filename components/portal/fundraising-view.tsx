"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Copy, Pencil, Plus, Share2, Trash2 } from "lucide-react"
import { QrCodeImage } from "@/components/ui/qr-code-image"
import { DatePicker, dateToYmd, ymdToDate } from "@/components/portal/date-time-picker"
import { DueCollectionsTab, type DueCollectionRow } from "@/components/portal/due-collections-tab"

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

function seasonLabel(year: number): string {
  return `${year}\u2013${year + 1}`
}

const SOURCE_TYPES = [
  { value: "donation", label: "Donation" },
  { value: "advertisement_banner", label: "Advertisement Banner" },
  { value: "game_program_ad", label: "Game Program Ad" },
] as const

const PLATFORMS = [
  { value: "cashapp", label: "Cash App ($cashtag)" },
  { value: "venmo", label: "Venmo (@handle)" },
  { value: "paypal", label: "PayPal (URL)" },
  { value: "other", label: "Other" },
] as const

/** Returns a shareable URL for QR encoding, or null if we cannot derive one safely. */
function paymentRefToQrValue(platform: string, raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (platform === "cashapp") {
    const tag = t.startsWith("$") ? t.slice(1) : t
    if (!tag) return null
    return `https://cash.app/$${encodeURIComponent(tag)}`
  }
  if (platform === "venmo") {
    const h = t.startsWith("@") ? t.slice(1) : t
    if (!h) return null
    return `https://venmo.com/${encodeURIComponent(h)}`
  }
  if (platform === "paypal") return null
  return null
}

type BudgetRow = {
  id?: string
  team_id?: string
  season_year: number
  school_allocation: number | null
  goal_amount: number | null
  notes: string | null
  affiliate_url: string | null
  affiliate_label: string | null
  updated_at?: string
}

type EntryRow = {
  id: string
  team_id?: string
  season_year: number
  source_type: string
  source_name: string
  amount: number
  received_date: string
  notes: string | null
  created_at?: string
}

type RefRow = {
  id: string
  platform: string
  handle_or_url: string
  display_label: string | null
  sort_order: number
}

type RecentRow = {
  kind: "budget" | "donation"
  label: string
  amount: number | null
  at: string
}

type FullPayload = {
  access: "full"
  seasonYear: number
  budget: BudgetRow | null
  entries: EntryRow[]
  paymentRefs: RefRow[]
  dueCollections: DueCollectionRow[]
  recentActivity: RecentRow[]
  canEdit: boolean
  canEditPaymentRefs: boolean
}

type PaymentOnlyPayload = {
  access: "payment_refs_only"
  paymentRefs: RefRow[]
  canEditPaymentRefs: boolean
}

type FinancesTab =
  | "overview"
  | "budget"
  | "fundraising"
  | "donations"
  | "payment_refs"
  | "due_collections"

export function FundraisingView({ teamId }: { teamId: string }) {
  const [seasonYear, setSeasonYear] = useState(() => new Date().getFullYear())
  const [tab, setTab] = useState<FinancesTab>("overview")
  const [data, setData] = useState<FullPayload | PaymentOnlyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/teams/${encodeURIComponent(teamId)}/fundraising?seasonYear=${seasonYear}`)
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || "Failed to load finances")
      }
      const j = (await r.json()) as FullPayload | PaymentOnlyPayload
      setData(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [teamId, seasonYear])

  useEffect(() => {
    void load()
  }, [load])

  if (data?.access === "payment_refs_only") {
    return (
      <div className="min-w-0 space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "rgb(var(--text))" }}>
            Finances
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
            Payment references only — for sharing with families. Braik does not process payments.
          </p>
        </div>
        <PaymentRefsSection
          teamId={teamId}
          refs={data.paymentRefs}
          canEdit={data.canEditPaymentRefs}
          affiliate={null}
          onChanged={load}
        />
      </div>
    )
  }

  return (
    <FundraisingShell seasonYear={seasonYear} setSeasonYear={setSeasonYear} tab={tab} setTab={setTab}>
      {loading && !data ? (
        <div className="space-y-4 mt-4">
          <div className="h-24 rounded-xl animate-pulse bg-muted" />
          <div className="h-48 rounded-xl animate-pulse bg-muted" />
        </div>
      ) : err || !data ? (
        <Card className="border mt-4" style={{ borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-8 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
            {err || "Unable to load finances."}
          </CardContent>
        </Card>
      ) : data.access === "full" ? (
        <FundraisingFullTabPanels
          teamId={teamId}
          payload={data}
          seasonYear={seasonYear}
          setSeasonYear={setSeasonYear}
          tab={tab}
          reload={load}
        />
      ) : null}
    </FundraisingShell>
  )
}

function SeasonPickerModal({
  open,
  onOpenChange,
  year,
  onSelect,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  year: number
  onSelect: (y: number) => void
}) {
  const years = useMemo(() => {
    const cy = new Date().getFullYear()
    return Array.from({ length: 14 }, (_, i) => cy - 6 + i)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select season</DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
          Data below is filtered by the selected season year.
        </p>
        <div className="grid max-h-[min(50vh,20rem)] gap-1 overflow-y-auto py-1">
          {years.map((y) => (
            <Button
              key={y}
              type="button"
              variant={y === year ? "default" : "ghost"}
              className="justify-start"
              style={y === year ? { backgroundColor: "rgb(var(--accent))", color: "white" } : undefined}
              onClick={() => {
                onSelect(y)
                onOpenChange(false)
              }}
            >
              {seasonLabel(y)}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FundraisingShell({
  seasonYear,
  setSeasonYear,
  tab,
  setTab,
  children,
}: {
  seasonYear: number
  setSeasonYear: (y: number) => void
  tab: FinancesTab
  setTab: (t: FinancesTab) => void
  children: ReactNode
}) {
  const [seasonModalOpen, setSeasonModalOpen] = useState(false)

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "rgb(var(--text))" }}>
            Finances
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
            Ledger and reference links — Braik does not process payments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => setSeasonModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={seasonModalOpen}
          >
            Season: {seasonLabel(seasonYear)}
          </Button>
        </div>
      </div>

      <SeasonPickerModal
        open={seasonModalOpen}
        onOpenChange={setSeasonModalOpen}
        year={seasonYear}
        onSelect={setSeasonYear}
      />

      <PortalUnderlineTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "budget", label: "Budget" },
          { id: "fundraising", label: "Fundraising" },
          { id: "donations", label: "Donations & Revenue" },
          { id: "payment_refs", label: "Payment References" },
          { id: "due_collections", label: "Due Collections" },
        ]}
        value={tab}
        onValueChange={(id) => setTab(id as FinancesTab)}
        ariaLabel="Finances sections"
      />

      {children}
    </div>
  )
}

function FundraisingFullTabPanels({
  teamId,
  payload,
  seasonYear,
  setSeasonYear,
  tab,
  reload,
}: {
  teamId: string
  payload: FullPayload
  seasonYear: number
  setSeasonYear: (y: number) => void
  tab: FinancesTab
  reload: () => Promise<void>
}) {
  const canEdit = payload.canEdit
  const dueCollections = payload.dueCollections ?? []

  return (
    <>
      {tab === "overview" && (
        <FinancesOverviewTab payload={payload} seasonYear={seasonYear} />
      )}
      {tab === "budget" && (
        <BudgetTab
          teamId={teamId}
          payload={payload}
          seasonYear={seasonYear}
          setSeasonYear={setSeasonYear}
          canEdit={canEdit}
          onSaved={reload}
        />
      )}
      {tab === "fundraising" && (
        <FundraisingProgressTab payload={payload} seasonYear={seasonYear} />
      )}
      {tab === "donations" && (
        <DonationsTab teamId={teamId} payload={payload} seasonYear={seasonYear} canEdit={canEdit} onSaved={reload} />
      )}
      {tab === "payment_refs" && (
        <PaymentRefsSection
          teamId={teamId}
          refs={payload.paymentRefs}
          canEdit={canEdit}
          affiliate={
            payload.budget
              ? {
                  label: payload.budget.affiliate_label,
                  url: payload.budget.affiliate_url,
                }
              : null
          }
          onChanged={reload}
        />
      )}
      {tab === "due_collections" && (
        <DueCollectionsTab
          teamId={teamId}
          rows={dueCollections}
          seasonYear={seasonYear}
          canEdit={canEdit}
          onSaved={reload}
        />
      )}
    </>
  )
}

function FinancesOverviewTab({ payload, seasonYear }: { payload: FullPayload; seasonYear: number }) {
  const budget = payload.budget
  const entries = payload.entries

  const donationTotal = useMemo(
    () => entries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [entries]
  )
  const hasSchool =
    budget != null && budget.school_allocation != null && !Number.isNaN(Number(budget.school_allocation))
  const hasDonations = entries.length > 0
  const schoolNum = hasSchool ? Number(budget!.school_allocation) : null
  const goal =
    budget?.goal_amount != null && !Number.isNaN(Number(budget.goal_amount)) ? Number(budget.goal_amount) : null
  const combined =
    hasSchool || hasDonations ? (schoolNum ?? 0) + (hasDonations ? donationTotal : 0) : null

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
        Internal tracking and reference links only — not payment processing. Use the tabs above for budgets, revenue,
        payment references, and amounts owed.
      </p>
      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">At a glance · {seasonLabel(seasonYear)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSchool && !hasDonations && (goal == null || goal <= 0) ? (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              No budget or donation entries for this season yet. Use the Budget and Donations &amp; Revenue tabs to add
              data.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  Current season
                </p>
                <p className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
                  {seasonLabel(seasonYear)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  School budget allocation
                </p>
                {hasSchool ? (
                  <p className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
                    {formatMoney(schoolNum!)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
                    Not entered — add a budget record for this season.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  Donations &amp; promotional revenue
                </p>
                {hasDonations ? (
                  <p className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
                    {formatMoney(donationTotal)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
                    No entries yet — add revenue in Donations &amp; Revenue.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  Combined total
                </p>
                {combined != null && (hasSchool || hasDonations) ? (
                  <p className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--accent))" }}>
                    {formatMoney(combined)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
                    Add budget or donations to see a combined total.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FundraisingProgressTab({ payload, seasonYear }: { payload: FullPayload; seasonYear: number }) {
  const budget = payload.budget
  const entries = payload.entries

  const donationTotal = useMemo(
    () => entries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [entries]
  )
  const hasSchool =
    budget != null && budget.school_allocation != null && !Number.isNaN(Number(budget.school_allocation))
  const hasDonations = entries.length > 0
  const schoolNum = hasSchool ? Number(budget!.school_allocation) : null
  const goal =
    budget?.goal_amount != null && !Number.isNaN(Number(budget.goal_amount)) ? Number(budget.goal_amount) : null
  const combined =
    hasSchool || hasDonations ? (schoolNum ?? 0) + (hasDonations ? donationTotal : 0) : null

  const recent = payload.recentActivity ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
        Track progress toward your program goals. Figures are entered manually for planning — Braik does not process
        payments.
      </p>
      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fundraising · {seasonLabel(seasonYear)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goal != null && goal > 0 ? (
            <div>
              <div className="mb-1 flex justify-between text-xs" style={{ color: "rgb(var(--muted))" }}>
                <span>Goal</span>
                <span>{formatMoney(goal)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--platinum))]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(((combined ?? 0) / goal) * 100))}%`,
                    backgroundColor: "rgb(var(--accent))",
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              Set an optional goal in the Budget tab to see progress here.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              No recent budget updates or donation entries for this season.
            </p>
          ) : (
            <ul className="divide-y text-sm" style={{ borderColor: "rgb(var(--border))" }}>
              {recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span style={{ color: "rgb(var(--text))" }}>{r.label}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {r.amount != null ? (
                      <span className="font-medium tabular-nums" style={{ color: "rgb(var(--text))" }}>
                        {formatMoney(r.amount)}
                      </span>
                    ) : null}
                    <span>{new Date(r.at).toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BudgetTab({
  teamId,
  payload,
  seasonYear,
  setSeasonYear,
  canEdit,
  onSaved,
}: {
  teamId: string
  payload: FullPayload
  seasonYear: number
  setSeasonYear: (y: number) => void
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const b = payload.budget
  const [open, setOpen] = useState(false)
  const [newSeasonOpen, setNewSeasonOpen] = useState(false)
  const [newSeasonStartYear, setNewSeasonStartYear] = useState(seasonYear + 1)

  useEffect(() => {
    setNewSeasonStartYear(seasonYear + 1)
  }, [seasonYear])
  const [draft, setDraft] = useState({
    schoolAllocation: "",
    goalAmount: "",
    notes: "",
    affiliateUrl: "",
    affiliateLabel: "",
  })

  useEffect(() => {
    setDraft({
      schoolAllocation: b?.school_allocation != null ? String(b.school_allocation) : "",
      goalAmount: b?.goal_amount != null ? String(b.goal_amount) : "",
      notes: b?.notes ?? "",
      affiliateUrl: b?.affiliate_url ?? "",
      affiliateLabel: b?.affiliate_label ?? "",
    })
  }, [b])

  const save = async (targetYear?: number) => {
    const y = targetYear ?? seasonYear
    if (targetYear != null) setSeasonYear(y)
    const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/fundraising`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_budget",
        seasonYear: y,
        schoolAllocation: draft.schoolAllocation === "" ? null : Number(draft.schoolAllocation),
        goalAmount: draft.goalAmount === "" ? null : Number(draft.goalAmount),
        notes: draft.notes,
        affiliateUrl: draft.affiliateUrl,
        affiliateLabel: draft.affiliateLabel,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert((j as { error?: string }).error || "Save failed")
      return
    }
    setOpen(false)
    setNewSeasonOpen(false)
    await onSaved()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setNewSeasonStartYear(seasonYear + 1)
                setNewSeasonOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New season
            </Button>
          </>
        )}
      </div>

      {!b ? (
        <Card className="border" style={{ borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-8 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
            <p>No budget record for {seasonLabel(seasonYear)}.</p>
            {canEdit && (
              <Button type="button" className="mt-3" size="sm" onClick={() => setOpen(true)}>
                Create budget for this season
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="space-y-2 pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <span style={{ color: "rgb(var(--muted))" }}>Season</span>
              <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
                {seasonLabel(b.season_year)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span style={{ color: "rgb(var(--muted))" }}>School allocation</span>
              <span className="font-medium tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {b.school_allocation != null ? formatMoney(Number(b.school_allocation)) : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span style={{ color: "rgb(var(--muted))" }}>Fundraising goal</span>
              <span className="font-medium tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {b.goal_amount != null ? formatMoney(Number(b.goal_amount)) : "—"}
              </span>
            </div>
            {b.notes ? (
              <div className="pt-2">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap" style={{ color: "rgb(var(--text))" }}>
                  {b.notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Budget · {seasonLabel(seasonYear)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="fb-alloc">School budget allocation</Label>
              <Input
                id="fb-alloc"
                inputMode="decimal"
                value={draft.schoolAllocation}
                onChange={(e) => setDraft((d) => ({ ...d, schoolAllocation: e.target.value }))}
                placeholder="Amount"
              />
            </div>
            <div>
              <Label htmlFor="fb-goal">Optional fundraising goal</Label>
              <Input
                id="fb-goal"
                inputMode="decimal"
                value={draft.goalAmount}
                onChange={(e) => setDraft((d) => ({ ...d, goalAmount: e.target.value }))}
                placeholder="Goal amount"
              />
            </div>
            <div>
              <Label htmlFor="fb-notes">Notes</Label>
              <textarea
                id="fb-notes"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={3}
                className={cn(
                  "flex min-h-[88px] w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50 transition-colors input-theme"
                )}
              />
            </div>
            <div className="border-t border-[#E5E7EB] pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Optional external affiliate link
              </p>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="fb-aff-label">Label</Label>
                  <Input
                    id="fb-aff-label"
                    value={draft.affiliateLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, affiliateLabel: e.target.value }))}
                    placeholder='e.g. "Team merchandise store"'
                  />
                </div>
                <div>
                  <Label htmlFor="fb-aff-url">URL</Label>
                  <Input
                    id="fb-aff-url"
                    value={draft.affiliateUrl}
                    onChange={(e) => setDraft((d) => ({ ...d, affiliateUrl: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSeasonOpen} onOpenChange={setNewSeasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New season budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fb-new-y">Season start year</Label>
            <Input
              id="fb-new-y"
              type="number"
              value={newSeasonStartYear}
              min={2000}
              max={2100}
              onChange={(e) => setNewSeasonStartYear(Math.max(2000, parseInt(e.target.value, 10) || seasonYear + 1))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewSeasonOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save(newSeasonStartYear)}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DonationsTab({
  teamId,
  payload,
  seasonYear,
  canEdit,
  onSaved,
}: {
  teamId: string
  payload: FullPayload
  seasonYear: number
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const entries = payload.entries
  const [sortKey, setSortKey] = useState<"received_date" | "amount" | "source_type">("received_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [editor, setEditor] = useState<EntryRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    sourceType: "donation",
    sourceName: "",
    amount: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  const sorted = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount)
      else if (sortKey === "source_type") cmp = String(a.source_type).localeCompare(String(b.source_type))
      else cmp = String(a.received_date).localeCompare(String(b.received_date))
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [entries, sortKey, sortDir])

  const subtotals = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of entries) {
      const k = e.source_type
      m[k] = (m[k] ?? 0) + (Number(e.amount) || 0)
    }
    return m
  }, [entries])

  const grand = useMemo(() => entries.reduce((s, e) => s + (Number(e.amount) || 0), 0), [entries])

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(k)
      setSortDir(k === "received_date" ? "desc" : "asc")
    }
  }

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/fundraising`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert((j as { error?: string }).error || "Request failed")
      return false
    }
    return true
  }

  const saveEntry = async () => {
    const ok = editor
      ? await post({
          action: "update_entry",
          id: editor.id,
          seasonYear,
          sourceType: draft.sourceType,
          sourceName: draft.sourceName,
          amount: Number(draft.amount) || 0,
          receivedDate: draft.receivedDate,
          notes: draft.notes || null,
        })
      : await post({
          action: "add_entry",
          seasonYear,
          sourceType: draft.sourceType,
          sourceName: draft.sourceName,
          amount: Number(draft.amount) || 0,
          receivedDate: draft.receivedDate,
          notes: draft.notes || null,
        })
    if (!ok) return
    setEditor(null)
    setCreating(false)
    await onSaved()
  }

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return
    const ok = await post({ action: "delete_entry", id })
    if (ok) await onSaved()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCreating(true)
                setEditor(null)
                setDraft({
                  sourceType: "donation",
                  sourceName: "",
                  amount: "",
                  receivedDate: new Date().toISOString().slice(0, 10),
                  notes: "",
                })
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add entry
            </Button>
          </>
        )}
      </div>

      {Object.keys(subtotals).length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {SOURCE_TYPES.map((st) =>
            subtotals[st.value] != null && subtotals[st.value]! > 0 ? (
              <span key={st.value} style={{ color: "rgb(var(--muted))" }}>
                <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
                  {st.label}:
                </span>{" "}
                {formatMoney(subtotals[st.value]!)}
              </span>
            ) : null
          )}
        </div>
      )}

      <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgb(var(--border))" }}>
            <span className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
              All entries
            </span>
            {entries.length > 0 ? (
              <span className="text-sm tabular-nums font-semibold" style={{ color: "rgb(var(--accent))" }}>
                Total {formatMoney(grand)}
              </span>
            ) : (
              <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                No entries yet
              </span>
            )}
          </div>
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
              No donations or promotional revenue recorded for this season.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "rgb(var(--border))" }}>
                    <th className="px-4 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("source_type")}>
                        Source {sortKey === "source_type" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("amount")}>
                        Amount {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-4 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("received_date")}>
                        Date {sortKey === "received_date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-4 py-2">Notes</th>
                    {canEdit ? <th className="px-4 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr key={e.id} className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
                      <td className="px-4 py-2 capitalize" style={{ color: "rgb(var(--text))" }}>
                        {SOURCE_TYPES.find((s) => s.value === e.source_type)?.label ?? e.source_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2">{e.source_name}</td>
                      <td className="px-4 py-2 tabular-nums font-medium">{formatMoney(Number(e.amount))}</td>
                      <td className="px-4 py-2">{e.received_date}</td>
                      <td className="max-w-[200px] truncate px-4 py-2 text-xs" style={{ color: "rgb(var(--muted))" }}>
                        {e.notes ?? "—"}
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditor(e)
                              setCreating(false)
                              setDraft({
                                sourceType: e.source_type,
                                sourceName: e.source_name,
                                amount: String(e.amount),
                                receivedDate: e.received_date,
                                notes: e.notes ?? "",
                              })
                            }}
                            aria-label="Edit entry"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => void deleteEntry(e.id)}
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={creating || !!editor}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditor(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor ? "Edit entry" : "Add entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Source type</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.sourceType}
                onChange={(e) => setDraft((d) => ({ ...d, sourceType: e.target.value }))}
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="de-name">Donor or sponsor name</Label>
              <Input
                id="de-name"
                value={draft.sourceName}
                onChange={(e) => setDraft((d) => ({ ...d, sourceName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="de-amt">Amount</Label>
              <Input
                id="de-amt"
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="de-date">Date received</Label>
              <Input
                id="de-date"
                type="date"
                value={draft.receivedDate}
                onChange={(e) => setDraft((d) => ({ ...d, receivedDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="de-notes">Notes (optional)</Label>
              <textarea
                id="de-notes"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className={cn(
                  "flex min-h-[72px] w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50 transition-colors input-theme"
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => (setCreating(false), setEditor(null))}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEntry()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentRefsSection({
  teamId,
  refs,
  canEdit,
  affiliate,
  onChanged,
}: {
  teamId: string
  refs: RefRow[]
  canEdit: boolean
  affiliate: { label: string | null; url: string | null } | null
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RefRow | null>(null)
  const [qrFor, setQrFor] = useState<RefRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RefRow | null>(null)
  const [draft, setDraft] = useState({ platform: "venmo", handleOrUrl: "", displayLabel: "" })

  const qrDialogValue = qrFor ? paymentRefToQrValue(qrFor.platform, qrFor.handle_or_url) : null

  useEffect(() => {
    if (editing) {
      setDraft({
        platform: editing.platform,
        handleOrUrl: editing.handle_or_url,
        displayLabel: editing.display_label ?? "",
      })
    } else {
      setDraft({ platform: "venmo", handleOrUrl: "", displayLabel: "" })
    }
  }, [editing, open])

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/fundraising`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert((j as { error?: string }).error || "Request failed")
      return false
    }
    return true
  }

  const saveRef = async () => {
    const ok = editing
      ? await post({
          action: "update_payment_ref",
          id: editing.id,
          platform: draft.platform,
          handleOrUrl: draft.handleOrUrl,
          displayLabel: draft.displayLabel || null,
        })
      : await post({
          action: "add_payment_ref",
          platform: draft.platform,
          handleOrUrl: draft.handleOrUrl,
          displayLabel: draft.displayLabel || null,
        })
    if (!ok) return
    setOpen(false)
    setEditing(null)
    await onChanged()
  }

  const executeDeleteRef = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    const ok = await post({ action: "delete_payment_ref", id })
    if (ok) {
      setDeleteTarget(null)
      await onChanged()
    }
  }

  const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p

  const sharePaymentRef = async (r: RefRow) => {
    const label = platformLabel(r.platform)
    const body = [
      label,
      r.display_label ? `${r.display_label}: ${r.handle_or_url}` : r.handle_or_url,
    ].join("\n")
    const qrUrl = paymentRefToQrValue(r.platform, r.handle_or_url)
    const url = qrUrl || (r.handle_or_url.trim().startsWith("http") ? r.handle_or_url.trim() : undefined)
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Payment reference",
          text: url ? `${body}\n${url}` : body,
          url: url || undefined,
        })
        return
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return
    }
    try {
      await navigator.clipboard.writeText(url ? `${body}\n${url}` : body)
    } catch {
      alert("Could not share or copy this reference.")
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      alert("Could not copy")
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
        Reference links and QR codes for families to use elsewhere — Braik does not process payments.
      </p>
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add payment method
          </Button>
        )}
      </div>

      {affiliate?.url ? (
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                External program link
              </p>
              <a
                href={affiliate.url.startsWith("http") ? affiliate.url : `https://${affiliate.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm font-semibold text-[rgb(var(--accent))] underline"
              >
                {affiliate.label || affiliate.url}
              </a>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyText(affiliate.url!)}>
              <Copy className="mr-1.5 h-4 w-4" />
              Copy URL
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {refs.length === 0 ? (
        <Card className="border" style={{ borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-8 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
            No payment methods added yet.
            {canEdit ? " Use Add payment method to share Cash App, Venmo, PayPal, or other links." : ""}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {refs.map((r) => {
            const qrValue = paymentRefToQrValue(r.platform, r.handle_or_url)
            return (
            <Card key={r.id} className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                        {platformLabel(r.platform)}
                      </p>
                      <p className="mt-1 break-all text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                        {r.display_label || r.handle_or_url}
                      </p>
                      {r.display_label ? (
                        <p className="mt-1 break-all text-xs" style={{ color: "rgb(var(--muted))" }}>
                          {r.handle_or_url}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void sharePaymentRef(r)}>
                        <Share2 className="mr-1.5 h-4 w-4" />
                        Share
                      </Button>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2 border-t pt-3" style={{ borderColor: "rgb(var(--border))" }}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(r)
                            setOpen(true)
                          }}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {qrValue ? (
                    <div className="flex shrink-0 flex-col items-center gap-1 sm:min-w-[7.5rem]">
                      <button
                        type="button"
                        className="rounded-lg border p-1.5 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
                        onClick={() => setQrFor(r)}
                        aria-label="Enlarge QR code"
                      >
                        <QrCodeImage value={qrValue} size={104} />
                      </button>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto py-0 text-xs"
                        onClick={() => setQrFor(r)}
                      >
                        Enlarge
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove payment reference?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            This removes{" "}
            <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
              {deleteTarget?.display_label || deleteTarget?.handle_or_url}
            </span>{" "}
            from your payment references. This cannot be undone.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void executeDeleteRef()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment reference QR</DialogTitle>
          </DialogHeader>
          <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
            Scan to open this link or profile on a phone. For reference only — Braik does not process payments.
          </p>
          {qrDialogValue ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <QrCodeImage value={qrDialogValue} size={200} />
              <p className="max-w-full break-all text-center text-xs" style={{ color: "rgb(var(--muted))" }}>
                {qrDialogValue}
              </p>
            </div>
          ) : (
            <p className="text-sm text-center" style={{ color: "rgb(var(--muted))" }}>
              No encodable link for this entry.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQrFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment method" : "Add payment method"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Platform</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.platform}
                onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value }))}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pr-handle">Handle or URL</Label>
              <Input
                id="pr-handle"
                value={draft.handleOrUrl}
                onChange={(e) => setDraft((d) => ({ ...d, handleOrUrl: e.target.value }))}
                placeholder="$cashtag, @handle, or https://"
              />
            </div>
            <div>
              <Label htmlFor="pr-lbl">Display label (optional)</Label>
              <Input
                id="pr-lbl"
                value={draft.displayLabel}
                onChange={(e) => setDraft((d) => ({ ...d, displayLabel: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveRef()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
