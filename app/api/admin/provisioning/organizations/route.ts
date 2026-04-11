import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, video_clips_enabled, coach_b_plus_enabled")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ organizations: data ?? [] })
}

export async function POST(request: Request) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  let body: { name?: string; slug?: string | null; video_clips_enabled?: boolean; coach_b_plus_enabled?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const slug =
    typeof body.slug === "string" && body.slug.trim().length > 0
      ? body.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "")
      : null

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name,
      slug: slug || null,
      video_clips_enabled: body.video_clips_enabled === true,
      coach_b_plus_enabled: body.coach_b_plus_enabled === true,
    })
    .select("id, name, slug, video_clips_enabled, coach_b_plus_enabled")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export const runtime = "nodejs"
