import Link from "next/link"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]/50">
      <div className="w-full px-6 md:px-8 lg:px-12 py-3 flex items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 rounded transition-all"
          aria-label="Braik - Return to home page"
        >
          <div className="h-12 w-[200px] flex items-center overflow-hidden">
            <img 
              src="/braik-logo.png" 
              alt="Braik" 
              className="w-full h-auto block object-contain object-left"
            />
          </div>
        </Link>
        <div className="flex items-center gap-3 md:gap-6">
          <Link href="/features" className="hidden md:inline text-[#212529] hover:text-[#3B82F6] transition-colors font-medium text-sm">
            Features
          </Link>
          <Link href="/about" className="hidden md:inline text-[#212529] hover:text-[#3B82F6] transition-colors font-medium text-sm">
            About
          </Link>
          <Link href="/why-braik" className="hidden lg:inline text-[#212529] hover:text-[#3B82F6] transition-colors font-medium text-sm">
            Why Braik
          </Link>
          <Link href="/pricing" className="text-[#212529] hover:text-[#3B82F6] transition-colors font-medium text-sm md:text-base">
            Pricing
          </Link>
          <Link href="/faq" className="text-[#212529] hover:text-[#3B82F6] transition-colors font-medium text-sm md:text-base">
            FAQ
          </Link>
          <Link href="/login">
            <Button size="sm" className="font-athletic uppercase tracking-wide px-5">
              Login
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
