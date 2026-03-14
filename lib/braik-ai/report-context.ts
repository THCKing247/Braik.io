import type { ContextModuleInput, ReportContext } from "./types"

/**
 * Report/uploaded content. No Braik table for extracted uploads yet; when implemented, fetch from that store.
 */
export async function getReportContext(_input: ContextModuleInput): Promise<ReportContext[]> {
  return []
}
