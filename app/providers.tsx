"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "@/lib/auth/client-auth"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { LastVisitedRouteTracker } from "@/components/navigation/last-visited-route-tracker"
import { NativeAppBootstrap } from "@/components/native/native-app-bootstrap"
import { DASHBOARD_BOOTSTRAP_STALE_MS } from "@/lib/dashboard/dashboard-bootstrap-query"

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
          {children}
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

