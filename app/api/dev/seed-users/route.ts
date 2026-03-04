import { NextResponse } from "next/server"
import { hasClientSupabaseEnv, missingSupabaseAdminEnv, requireSupabaseAdmin } from "@/src/lib/supabaseAdmin"
import { runDevSeedUsers } from "@/src/lib/devSeedUsers"

function canRunSeedRoute(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true
  }

  const expectedSeedKey = process.env.SEED_KEY
  const providedSeedKey = request.headers.get("x-seed-key")
  return Boolean(expectedSeedKey && providedSeedKey && providedSeedKey === expectedSeedKey)
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function POST(request: Request) {
  try {
    if (!canRunSeedRoute(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (missingSupabaseAdminEnv.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required environment variables: ${missingSupabaseAdminEnv.join(", ")}`,
        },
        { status: 500 }
      )
    }

    const summary = await runDevSeedUsers(requireSupabaseAdmin())

    return NextResponse.json(
      {
        success: true,
        usersSeeded: summary.createdAuthUsers,
        profilesUpserted: summary.profilesUpserted,
        teamId: summary.demoTeamId,
        users: summary.users,
        clientSupabaseEnvConfigured: hasClientSupabaseEnv(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Dev seed-users route failed")
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

