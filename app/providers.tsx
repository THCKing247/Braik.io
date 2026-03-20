"use client"

import { SessionProvider } from "@/lib/auth/client-auth"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { LastVisitedRouteTracker } from "@/components/navigation/last-visited-route-tracker"
import { NativeAppBootstrap } from "@/components/native/native-app-bootstrap"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  )
}

