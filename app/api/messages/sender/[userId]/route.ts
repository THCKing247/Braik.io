import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET /api/messages/sender/[userId]
 * Returns minimal sender info for a user (for realtime message rendering)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get user info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle()

    if (userError) {
      console.error("[GET /api/messages/sender/[userId]]", userError)
      return NextResponse.json({ error: "Failed to load sender" }, { status: 500 })
    }

    return NextResponse.json({
      id: user?.id || userId,
      name: user?.name || null,
      email: user?.email || ""
    })
  } catch (error: any) {
    console.error("[GET /api/messages/sender/[userId]]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load sender" },
      { status: 500 }
    )
  }
}
