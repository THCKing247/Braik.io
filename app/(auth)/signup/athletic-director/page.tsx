import { redirect } from "next/navigation"

/** AD accounts are provisioned by Braik/admins — public AD signup retired. */
export default function AthleticDirectorSignupPage() {
  redirect("/request-access")
}
