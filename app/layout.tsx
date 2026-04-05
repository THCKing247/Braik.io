import type { Metadata } from "next"
import { Inter, Teko, Oswald } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const teko = Teko({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-teko",
  display: "swap",
})

const oswald = Oswald({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Braik - Break the Huddle. Break the Norm.",
  description: "Sports team operating system for roster, dues, comms, schedule, docs, and AI admin assistant.",
  icons: { icon: "/favicon.ico" },
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  },
}

// Root layout stays static-friendly (no `force-dynamic`); routes/layouts that read cookies or headers opt into dynamic rendering.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${teko.variable} ${oswald.variable} font-sans`}>
        <div className="bg-[#1a1d21] text-[#9CA3AF] text-center text-xs md:text-sm font-medium py-2 px-4 tracking-wide">
          🚧&nbsp; Site currently under development &mdash; Braik v1.0.4 coming soon
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

