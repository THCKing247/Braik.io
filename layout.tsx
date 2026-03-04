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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${teko.variable} ${oswald.variable} font-sans`}>
        <div className="bg-[#DC2626] text-white text-center text-xs md:text-sm font-medium py-2 px-4">
          Site Is Currently Under Development - Braik Version 1.0.0 Coming Soon
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

