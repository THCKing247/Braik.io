import type { SupabaseClient } from "@supabase/supabase-js"

/** Sync collection row `status` from per-recipient contribution counts (pending / in_progress / completed). */
export async function syncDueCollectionAggregateStatus(supabase: SupabaseClient, collectionId: string): Promise<void> {
  const { data: rows, error } = await supabase
    .from("fundraising_due_collection_recipients")
    .select("contribution_status")
    .eq("collection_id", collectionId)
  if (error) throw new Error(error.message)
  const total = rows?.length ?? 0
  const collected = (rows ?? []).filter((r) => r.contribution_status === "collected").length
  let status: "pending" | "in_progress" | "completed" = "pending"
  if (total > 0 && collected === total) status = "completed"
  else if (collected > 0) status = "in_progress"
  else status = "pending"
  const { error: uErr } = await supabase
    .from("fundraising_due_collections")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", collectionId)
  if (uErr) throw new Error(uErr.message)
}
