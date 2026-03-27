import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { BRAIK_SIGNUP_SESSION_COOKIE } from "@/lib/auth/signup-session-cookie"

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  if (!isWaitlistMode()) {
    return <>{children}</>
  }

  const session = cookies().get(BRAIK_SIGNUP_SESSION_COOKIE)?.value
  if (session !== "1") {
    redirect("/waitlist")
  }

  return <>{children}</>
}
