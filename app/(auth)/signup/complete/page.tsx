import { redirect } from "next/navigation"

/** Retired final step for public coach/org signup. Parents use `/parent/join`. */
export default function CompleteSignupPage() {
  redirect("/request-access")
}
