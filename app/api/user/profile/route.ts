import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { updateSupabaseUserByAppUserId } from "@/lib/supabase-admin"

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email } = body

    const supabase = getSupabaseServer()

    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", session.user.id)
      .maybeSingle()

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updateData: { name?: string; email?: string } = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      const { data: existingByEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle()
      if (existingByEmail && existingByEmail.id !== session.user.id) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 })
      }
      updateData.email = email
    }

    await supabase.from("users").update(updateData).eq("id", session.user.id)

    const { data: membership } = await supabase
      .from("team_members")
      .select("role, team_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let supabaseSync: { synced: boolean; reason?: string } | undefined
    try {
      const syncResult = await updateSupabaseUserByAppUserId({
        appUserId: session.user.id,
        email: updateData.email ?? existingUser.email,
        name: updateData.name ?? existingUser.name,
        role: membership?.role,
        teamId: membership?.team_id,
      })
      supabaseSync = { synced: syncResult.synced, reason: syncResult.reason }
    } catch (syncError: unknown) {
      console.error("Supabase profile sync error:", syncError)
      supabaseSync = {
        synced: false,
        reason: syncError instanceof Error ? syncError.message : "Failed to sync profile to Supabase",
      }
    }

    const { data: updated } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", session.user.id)
      .single()

    return NextResponse.json({
      id: updated?.id,
      email: updated?.email,
      name: updated?.name,
      image: null,
      supabaseSync,
    })
  } catch (error: unknown) {
    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
