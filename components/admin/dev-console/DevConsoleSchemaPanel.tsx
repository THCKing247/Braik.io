"use client"

import { DEV_CONSOLE_MODELS, type DevModel } from "@/lib/admin/dev-console-schema"

const dc = {
  rail: "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm",
  k: "text-[10px] font-semibold uppercase tracking-wide text-neutral-500",
  v: "mt-0.5 text-xs font-medium text-neutral-900",
}

export function DevConsoleSchemaPanel({ model }: { model: DevModel }) {
  const meta = DEV_CONSOLE_MODELS.find((m) => m.id === model)

  if (!meta) return null

  return (
    <div className={`${dc.rail} flex max-h-[min(78vh,calc(100vh-140px))] flex-col gap-4 overflow-y-auto`}>
      <div>
        <p className="text-xs font-semibold text-neutral-900">{meta.label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{meta.description}</p>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
        <span className="font-semibold">Best field to search: </span>
        <span className="font-mono">{meta.bestSearchField}</span>
        <span className="text-neutral-600"> — indexed / high signal for this model.</span>
      </div>

      <div>
        <p className={dc.k}>Primary key</p>
        <p className={`${dc.v} font-mono text-[11px]`}>{meta.primaryKey}</p>
      </div>

      <div>
        <p className={dc.k}>Indexed fields</p>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-neutral-700">{meta.indexedFields.join(", ")}</p>
      </div>

      <div>
        <p className={dc.k}>Searchable</p>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-neutral-700">{meta.searchableFields.join(", ")}</p>
      </div>

      <div>
        <p className={dc.k}>Examples</p>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-neutral-700">
          {meta.exampleQueries.map((ex) => (
            <li key={ex}>{ex}</li>
          ))}
        </ul>
      </div>

      {meta.optionalTable ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-700">
          This table may be absent in sandboxes — if a query fails, switch model or confirm migrations.
        </div>
      ) : null}
    </div>
  )
}
