import { NextResponse } from "next/server"
import { z } from "zod"
import { loadPlatformRolesList } from "@/lib/admin/load-platform-roles-list"
import { requireManageRolesForApi } from "@/lib/permissions/platform-permissions"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isPlatformPermissionKey, type PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"

export const runtime = "nodejs"

const roleKeySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase snake_case (e.g. custom_analyst)")

const createBodySchema = z.object({
  key: roleKeySchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  isActive: z.boolean().optional().default(true),
  permissionKeys: z.array(z.string()).default([]),
  duplicateFromId: z.string().uuid().optional(),
})

export async function GET() {
  try {
    const access = await requireManageRolesForApi()
    if (!access.ok) {
      return access.response
    }

    const supabase = getSupabaseServer()
    const result = await loadPlatformRolesList(supabase)
    if (!result.ok) {
      console.error("[platform-roles] GET failed:", result.logDetail ?? result.error)
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      source: result.source,
      catalogReadOnly: result.catalogReadOnly,
      roles: result.roles,
      ...(result.permissionGroups ? { permissionGroups: result.permissionGroups } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error"
    console.error("[platform-roles] GET unhandled:", e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireManageRolesForApi()
  if (!access.ok) {
    return access.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { key, name, description, isActive, permissionKeys: rawKeys, duplicateFromId } = parsed.data
  const supabase = getSupabaseServer()

  let keys: PlatformPermissionKey[] = []
  if (duplicateFromId) {
    const { data: source } = await supabase.from("platform_roles").select("id").eq("id", duplicateFromId).maybeSingle()
    if (!source) {
      return NextResponse.json({ error: "Source role not found" }, { status: 404 })
    }
    const { data: perms } = await supabase
      .from("platform_role_permissions")
      .select("permission_key")
      .eq("role_id", duplicateFromId)
    keys = (perms ?? [])
      .map((p) => (p as { permission_key: string }).permission_key)
      .filter((k): k is PlatformPermissionKey => isPlatformPermissionKey(k))
  } else {
    for (const k of rawKeys) {
      if (!isPlatformPermissionKey(k)) {
        return NextResponse.json({ error: `Invalid permission key: ${k}` }, { status: 400 })
      }
      keys.push(k)
    }
  }

  const { data: created, error: insertErr } = await supabase
    .from("platform_roles")
    .insert({
      key,
      name,
      description: description ?? "",
      role_type: "custom",
      is_active: isActive,
      is_deletable: true,
      is_key_editable: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertErr || !created) {
    const msg = insertErr?.message ?? "Insert failed"
    const code = msg.includes("duplicate") || msg.includes("unique") ? 409 : 500
    return NextResponse.json({ error: msg }, { status: code })
  }

  const roleId = (created as { id: string }).id
  if (keys.length > 0) {
    const { error: permErr } = await supabase.from("platform_role_permissions").insert(
      keys.map((k) => ({
        role_id: roleId,
        permission_key: k,
      }))
    )
    if (permErr) {
      await supabase.from("platform_roles").delete().eq("id", roleId)
      return NextResponse.json({ error: permErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, id: roleId })
}
