import { NextResponse } from "next/server"
import { z } from "zod"
import { requireManageRolesForApi } from "@/lib/permissions/platform-permissions"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isPlatformPermissionKey, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

export const runtime = "nodejs"

const patchBodySchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  permissionKeys: z.array(z.string()).optional(),
})

export async function GET(_request: Request, context: { params: Promise<{ roleId: string }> }) {
  const access = await requireManageRolesForApi()
  if (!access.ok) {
    return access.response
  }

  const { roleId } = await context.params
  const supabase = getSupabaseServer()
  const { data: role, error } = await supabase.from("platform_roles").select("*").eq("id", roleId).maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: permRows } = await supabase.from("platform_role_permissions").select("permission_key").eq("role_id", roleId)

  const permissionKeys = (permRows ?? [])
    .map((p) => (p as { permission_key: string }).permission_key)
    .filter((k) => isPlatformPermissionKey(k)) as PlatformPermissionKey[]

  const { count: userCountRaw } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("platform_role_id", roleId)

  return NextResponse.json({
    role,
    permissionKeys,
    userCount: userCountRaw ?? 0,
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ roleId: string }> }) {
  const access = await requireManageRolesForApi()
  if (!access.ok) {
    return access.response
  }

  const { roleId } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data: existing, error: loadErr } = await supabase.from("platform_roles").select("*").eq("id", roleId).maybeSingle()
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const row = existing as {
    is_key_editable?: boolean
    key?: string
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive

  if (parsed.data.key !== undefined) {
    if (!row.is_key_editable) {
      return NextResponse.json({ error: "This system role cannot change its key." }, { status: 403 })
    }
    updates.key = parsed.data.key
  }

  const shouldPatchRole =
    parsed.data.name !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.isActive !== undefined ||
    parsed.data.key !== undefined

  if (shouldPatchRole) {
    const { error: upErr } = await supabase.from("platform_roles").update(updates).eq("id", roleId)
    if (upErr) {
      const code = upErr.message.includes("duplicate") || upErr.message.includes("unique") ? 409 : 500
      return NextResponse.json({ error: upErr.message }, { status: code })
    }
  }

  if (parsed.data.permissionKeys) {
    const keys: PlatformPermissionKey[] = []
    for (const k of parsed.data.permissionKeys) {
      if (!isPlatformPermissionKey(k)) {
        return NextResponse.json({ error: `Invalid permission key: ${k}` }, { status: 400 })
      }
      keys.push(k)
    }
    const { error: delErr } = await supabase.from("platform_role_permissions").delete().eq("role_id", roleId)
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }
    if (keys.length > 0) {
      const { error: insErr } = await supabase.from("platform_role_permissions").insert(
        keys.map((k) => ({ role_id: roleId, permission_key: k }))
      )
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
    if (!shouldPatchRole) {
      await supabase
        .from("platform_roles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", roleId)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, context: { params: Promise<{ roleId: string }> }) {
  const access = await requireManageRolesForApi()
  if (!access.ok) {
    return access.response
  }

  const { roleId } = await context.params
  const supabase = getSupabaseServer()
  const { data: existing, error: loadErr } = await supabase.from("platform_roles").select("is_deletable, key").eq("id", roleId).maybeSingle()
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const meta = existing as { is_deletable?: boolean; key?: string }
  if (!meta.is_deletable) {
    return NextResponse.json({ error: "This role cannot be deleted." }, { status: 403 })
  }

  const { data: blockingUser } = await supabase.from("users").select("id").eq("platform_role_id", roleId).limit(1).maybeSingle()
  if (blockingUser) {
    return NextResponse.json({ error: "Remove users from this role before deleting it." }, { status: 409 })
  }

  const { error: delErr } = await supabase.from("platform_roles").delete().eq("id", roleId)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
