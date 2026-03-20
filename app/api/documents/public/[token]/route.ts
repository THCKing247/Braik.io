import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { readTeamDocumentFromUrl } from "@/lib/documents/team-document-storage"

/**
 * GET /api/documents/public/[token]
 * Read-only access when document has a public_share_token (no session).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token || token.length < 8) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, file_url, file_name, mime_type, public_share_token")
      .eq("public_share_token", token)
      .maybeSingle()

    if (error || !doc || !doc.public_share_token) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const file = await readTeamDocumentFromUrl(doc.file_url, doc.mime_type)
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const disposition = `inline; filename="${encodeURIComponent(doc.file_name || "document")}"`
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch (err) {
    console.error("[GET /api/documents/public/[token]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
