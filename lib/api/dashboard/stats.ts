import { fetchJson, type FetchJsonInit } from "@/lib/api/core/fetch-json"

/** Coach dashboard hint strip — same endpoint deferred-core merges counts from (`engagementHintCounts`). */
export type EngagementHintsApiResponse = {
  hints?: unknown[]
  /** Extend when the route adds fields; callers cast as needed. */
  [key: string]: unknown
}

export async function fetchEngagementHints(
  teamId: string,
  init?: Pick<FetchJsonInit, "signal">
): Promise<EngagementHintsApiResponse> {
  return fetchJson<EngagementHintsApiResponse>(
    `/api/engagement/hints?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin", ...init }
  )
}
