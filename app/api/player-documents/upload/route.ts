import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess } from "@/lib/player-documents/access"
import {
  PLAYER_DOCUMENT_CONSENT_TEXT,
  DEFAULT_RETENTION_DAYS,
  isPlayerDocumentType,
  type DocumentType,
} from "@/lib/player-documents/constants"
import {
  assertMimeAndSize,
  buildPlayerDocumentStoragePath,
  sanitizeFileName,
  uploadPlayerDocumentToStorage,
} from "@/lib/player-documents/storage"
import { writeDocumentAuditLog } from "@/lib/player-documents/audit"
import { extractDocumentText, isExtractableMime } from "@/lib/documents/extract-text"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const teamId = (formData.get("teamId") as string)?.trim()
    const playerId = (formData.get("playerId") as string)?.trim()
    const documentTypeRaw = ((formData.get("documentType") as string) ?? "other").trim().toLowerCase()
    const documentType: DocumentType = isPlayerDocumentType(documentTypeRaw) ? documentTypeRaw : "other"
    const seasonLabel = ((formData.get("seasonLabel") as string) ?? "").trim() || null
    const notes = ((formData.get("notes") as string) ?? "").trim() || null
    const retentionDaysRaw = Number((formData.get("retentionDays") as string) ?? DEFAULT_RETENTION_DAYS)
    const retentionDays =
      Number.isFinite(retentionDaysRaw) && retentionDaysRaw > 0 && retentionDaysRaw <= 3650
        ? Math.floor(retentionDaysRaw)
        : DEFAULT_RETENTION_DAYS
    const consent = formData.get("consent") === "true" || formData.get("consent") === "on"
    const title = ((formData.get("title") as string) ?? "").trim() || "Document"
    const file = formData.get("file") as File | null

    if (!teamId || !playerId || !file) {
      return NextResponse.json({ error: "teamId, playerId, and file are required" }, { status: 400 })
    }

    if (!consent) {
      return NextResponse.json({ error: "Consent is required before upload." }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, playerId, teamId)
    // canUpload is true for staff, the rostered player (user_id match), and linked parents — see lib/player-documents/access.ts.
    if (!access?.canUpload) {
      return NextResponse.json({ error: "You cannot upload documents for this player." }, { status: 403 })
    }

    const check = assertMimeAndSize(file.type || null, file.size, file.name)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
    const effectiveMime = check.effectiveMime

    const { data: team } = await supabase
      .from("teams")
      .select("id, program_id")
      .eq("id", teamId)
      .maybeSingle()

    let programId: string | null = (team as { program_id?: string } | null)?.program_id ?? null
    let orgId: string | null = null
    if (programId) {
      const { data: pr } = await supabase
        .from("programs")
        .select("organization_id")
        .eq("id", programId)
        .maybeSingle()
      orgId = (pr as { organization_id?: string } | null)?.organization_id ?? null
    }

    const { data: playerRow } = await supabase
      .from("players")
      .select("user_id")
      .eq("id", playerId)
      .maybeSingle()
    const childProfileId = (playerRow as { user_id: string | null } | null)?.user_id ?? null

    const uploadedFor =
      access.isParent && childProfileId
        ? childProfileId
        : access.isPlayer
          ? session.user.id
          : childProfileId

    const docId = randomUUID()
    const safeName = sanitizeFileName(file.name)
    const storagePath = buildPlayerDocumentStoragePath({
      orgId,
      teamId,
      playerId,
      documentType,
      documentId: docId,
      safeFileName: safeName,
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await uploadPlayerDocumentToStorage(supabase, storagePath, buffer, effectiveMime)
    if (up.error) {
      return NextResponse.json({ error: up.error }, { status: 500 })
    }

    const uploadedAt = new Date().toISOString()
    const expiresAt = new Date(new Date(uploadedAt).getTime() + retentionDays * 86400000).toISOString()

    const { data: inserted, error: insErr } = await supabase
      .from("player_documents")
      .insert({
        id: docId,
        player_id: playerId,
        team_id: teamId,
        org_id: orgId,
        program_id: programId,
        title,
        file_name: file.name,
        file_path: storagePath,
        file_url: null,
        file_size: file.size,
        file_size_bytes: file.size,
        mime_type: effectiveMime,
        category: documentType,
        document_type: documentType,
        created_by: session.user.id,
        uploaded_by_profile_id: session.user.id,
        uploaded_for_profile_id: uploadedFor,
        consent_acknowledged: true,
        consent_text: PLAYER_DOCUMENT_CONSENT_TEXT,
        retention_days: retentionDays,
        expires_at: expiresAt,
        uploaded_at: uploadedAt,
        season_label: seasonLabel,
        notes,
        status: "active",
        visible_to_player: true,
      })
      .select()
      .single()

    if (insErr || !inserted) {
      await supabase.storage.from("player-documents").remove([storagePath]).catch(() => undefined)
      console.error("[POST /api/player-documents/upload]", insErr?.message)
      return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 })
    }

    if (isExtractableMime(effectiveMime)) {
      try {
        const result = await extractDocumentText(buffer, effectiveMime, file.name)
        if ("text" in result && result.text) {
          await supabase.from("player_documents").update({ extracted_text: result.text }).eq("id", docId)
        }
      } catch {
        /* extraction optional */
      }
    }

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    await writeDocumentAuditLog(supabase, {
      documentId: docId,
      actorProfileId: session.user.id,
      actorRole: (prof as { role?: string } | null)?.role ?? null,
      action: "upload",
      accessMethod: "api",
      metadata: { team_id: teamId, player_id: playerId, document_type: documentType },
    })

    return NextResponse.json({
      id: docId,
      expiresAt,
      retentionDays,
      documentType,
      title,
      fileName: file.name,
    })
  } catch (err) {
    console.error("[POST /api/player-documents/upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
