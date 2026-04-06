import Link from "next/link"
import { DocumentAuditClient } from "./document-audit-client"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default function DocumentAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/audit" className={cn(adminUi.link, "text-sm")}>
          ← Legacy audit
        </Link>
        <h2 className="mt-2 font-athletic text-xl font-bold uppercase tracking-wide text-white">
          Player document access log
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Uploads, views, downloads, signed URL generation, and deletes for participation documents (physicals, waivers,
          permission slips). IP may be null behind some proxies.
        </p>
      </div>
      <DocumentAuditClient />
    </div>
  )
}
