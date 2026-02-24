import Link from "next/link"
import Image from "next/image"

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center mb-4">
              <div className="h-10 md:h-12 lg:h-16 w-auto overflow-hidden flex items-center">
                <Image 
                  src="/braik-logo.png" 
                  alt="Braik Logo" 
                  width={720} 
                  height={360} 
                  className="h-[140%] w-auto object-contain object-center -my-[20%] cursor-default"
                />
              </div>
            </div>
            <p className="text-[#212529] text-sm mb-4">
              Break the Huddle. Break the Norm.
            </p>
            <p className="text-[#212529] text-sm">
              The sports team operating system for roster, dues, comms, schedule, docs, and AI admin assistant.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-lg font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-4">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/features" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  About
                </Link>
              </li>
              <li>
                <Link href="/why-braik" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Why Braik?
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://apextsgroup.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm"
                >
                  Apex TSG
                </a>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-lg font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-4">
              Account
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Legal */}
          <div>
            <h4 className="text-lg font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-4">
              Support & Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/faq" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Help Center
                </Link>
              </li>
              <li>
                <a href="mailto:support@braik.com" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Contact Us
                </a>
              </li>
              <li>
                <Link href="#" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-[#212529] hover:text-[#3B82F6] transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-[#E5E7EB] pt-8 text-center">
          <p className="text-[#212529] text-sm">
            &copy; 2024 Braik. All rights reserved.
          </p>
          <p className="text-[#6c757d] text-sm mt-2">
            Powered by Apex TSG
          </p>
        </div>
      </div>
    </footer>
  )
}
