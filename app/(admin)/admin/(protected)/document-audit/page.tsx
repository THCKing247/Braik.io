import Link from "next/link"
import { DocumentAuditClient } from "./document-audit-client"

export default function DocumentAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/audit" className="text-sm text-cyan-300/90 hover:text-cyan-200">
          ← Legacy audit
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-white">Player document access log</h2>
        <p className="mt-1 text-sm text-white/60">
          Uploads, views, downloads, signed URL generation, and deletes for participation documents (physicals, waivers, permission slips).
          IP may be null behind some proxies.
        </p>
      </div>
      <DocumentAuditClient />
    </div>
  )
}
