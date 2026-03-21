import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * GET /api/compliance/logs?teamId=...&format=json|csv
 * Compliance events for users linked to the team (profiles.team_id).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const format = (searchParams.get("format") || "json").toLowerCase()

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required", logs: [] }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("team_id", teamId)

    if (profErr) {
      console.error("[GET /api/compliance/logs] profiles", profErr)
      return NextResponse.json({ error: "Failed to resolve team members" }, { status: 500 })
    }

    const userIds = [...new Set((profiles ?? []).map((p: { id: string }) => p.id))]
    if (userIds.length === 0) {
      if (format === "csv") {
        const header = "id,eventType,policyVersion,timestamp,ipAddress,userEmail,userName\n"
        return new NextResponse(header, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="compliance-logs.csv"',
          },
        })
      }
      return NextResponse.json({ logs: [] })
    }

    const { data: logs, error: logErr } = await supabase
      .from("compliance_log")
      .select("id, user_id, event_type, policy_version, timestamp, ip_address")
      .in("user_id", userIds)
      .order("timestamp", { ascending: false })
      .limit(500)

    if (logErr) {
      const msg = logErr.message?.toLowerCase() ?? ""
      const missingTable = msg.includes("relation") && msg.includes("does not exist")
      console.error("[GET /api/compliance/logs] compliance_log", logErr)
      return NextResponse.json(
        {
          error: missingTable
            ? "Compliance logging is not available on this environment yet (table missing)."
            : "Compliance logs could not be loaded.",
          detail: logErr.message,
          logs: [],
        },
        { status: 503 }
      )
    }

    const logUserIds = [...new Set((logs ?? []).map((l: { user_id: string }) => l.user_id))]
    const { data: users, error: usersErr } =
      logUserIds.length > 0
        ? await supabase.from("users").select("id, name, email").in("id", logUserIds)
        : { data: [] as { id: string; name: string | null; email: string }[], error: null }

    if (usersErr) {
      console.warn("[GET /api/compliance/logs] users join soft-failed", usersErr.message)
    }

    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    const rows = (logs ?? []).map((row: Record<string, unknown>) => {
      const uid = row.user_id as string
      const u = userMap.get(uid)
      return {
        id: String(row.id),
        eventType: String(row.event_type ?? ""),
        policyVersion: String(row.policy_version ?? ""),
        timestamp: row.timestamp ? new Date(row.timestamp as string).toISOString() : "",
        ipAddress: (row.ip_address as string | null) ?? null,
        user: {
          name: u?.name ?? null,
          email: u?.email?.trim() || (uid ? "(profile not linked in users table)" : "Unknown"),
        },
      }
    })

    if (format === "csv") {
      const header = "id,eventType,policyVersion,timestamp,ipAddress,userEmail,userName\n"
      const body = rows
        .map((r) =>
          [
            csvEscape(r.id),
            csvEscape(r.eventType),
            csvEscape(r.policyVersion),
            csvEscape(r.timestamp),
            csvEscape(r.ipAddress ?? ""),
            csvEscape(r.user.email),
            csvEscape(r.user.name ?? ""),
          ].join(",")
        )
        .join("\n")
      return new NextResponse(header + body + (body ? "\n" : ""), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="compliance-logs.csv"',
        },
      })
    }

    return NextResponse.json({ logs: rows })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to load compliance logs" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: "You do not have access to this team's compliance logs." }, { status: 403 })
    }
    console.error("[GET /api/compliance/logs]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
