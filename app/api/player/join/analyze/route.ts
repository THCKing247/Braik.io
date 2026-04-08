import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { isPublicSignupAllowed } from "@/lib/config/public-signup"
import { analyzePlayerJoinMatch } from "@/lib/players/player-claim"
import type { PlayerMatchInput } from "@/lib/players/player-match"

function parseOptionalInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * POST /api/player/join/analyze
 * Public: resolves team by join code and returns match outcome without exposing the roster.
 */
export async function POST(request: Request) {
  try {
    if (!isPublicSignupAllowed()) {
      return NextResponse.json({ error: "Signup is not available." }, { status: 403 })
    }

    const body = (await request.json()) as {
      joinCode?: string
      firstName?: string
      lastName?: string
      jerseyNumber?: unknown
      graduationYear?: unknown
      dateOfBirth?: string
    }

    const joinCode = typeof body.joinCode === "string" ? body.joinCode.trim() : ""
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : ""
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : ""

    if (!joinCode || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Team join code, first name, and last name are required." },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const input: PlayerMatchInput = {
      firstName,
      lastName,
      jerseyNumber: parseOptionalInt(body.jerseyNumber),
      graduationYear: parseOptionalInt(body.graduationYear),
      dateOfBirth: typeof body.dateOfBirth === "string" && body.dateOfBirth.trim() ? body.dateOfBirth.trim().slice(0, 10) : null,
    }

    const result = await analyzePlayerJoinMatch(supabase, { joinCode, input })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[POST /api/player/join/analyze]", msg)
    return NextResponse.json({ error: "Could not analyze join request." }, { status: 500 })
  }
}
