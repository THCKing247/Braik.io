"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "@/lib/auth/client-auth"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { BraikPerfInstrumentation } from "@/components/perf/braik-perf-instrumentation"
import { DASHBOARD_BOOTSTRAP_STALE_MS } from "@/lib/dashboard/dashboard-bootstrap-query"

/** Deferred: not needed for first paint on web; loads in a separate chunk. */
const NativeAppBootstrap = dynamic(
  () => import("@/components/native/native-app-bootstrap").then((m) => m.NativeAppBootstrap),
  { ssr: false }
)

/** Deferred: path persistence for mobile resume — can load after hydration. */
const LastVisitedRouteTracker = dynamic(
  () =>
    import("@/components/navigation/last-visited-route-tracker").then((m) => m.LastVisitedRouteTracker),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DASHBOARD_BOOTSTRAP_STALE_MS,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <NativeAppBootstrap />
        <LastVisitedRouteTracker />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <BraikPerfInstrumentation />
          {children}
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

