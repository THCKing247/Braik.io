import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { BRAIK_SIGNUP_SESSION_COOKIE } from "@/lib/auth/signup-session-cookie"
import {
  BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER,
  BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER_VALUE,
} from "@/lib/auth/public-player-signup-header"

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  if (!isWaitlistMode()) {
    return <>{children}</>
  }

  if (headers().get(BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER) === BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER_VALUE) {
    return <>{children}</>
  }

  const session = cookies().get(BRAIK_SIGNUP_SESSION_COOKIE)?.value
  if (session !== "1") {
    redirect("/waitlist")
  }

  return <>{children}</>
}
