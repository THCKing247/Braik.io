/** Barrel — dashboard React Query surface (implementation lives under `lib/dashboard/*`). */
export {
  BRAIK_DASHBOARD_SHELL_QUERY_KEY,
  useDashboardShellQuery,
  invalidateDashboardShell,
  isDashboardShellUnauthorizedError,
} from "@/lib/dashboard/dashboard-shell-query"

export {
  DASHBOARD_BOOTSTRAP_STALE_MS,
  DEFERRED_HOME_FALLBACK_DELAY_MS,
  DEFERRED_HEAVY_AFTER_CORE_MS,
  dashboardBootstrapQueryKey,
  dashboardBootstrapMemoryKey,
  peekDashboardBootstrapMemory,
  kickDeferredCoreMerge,
  kickDeferredHeavyMerge,
  fetchDashboardBootstrap,
  useDashboardBootstrapQuery,
  invalidateDashboardBootstrap,
} from "@/lib/dashboard/dashboard-bootstrap-query"
