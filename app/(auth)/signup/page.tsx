import { redirect } from "next/navigation"

/** Public coach/org self-serve wizard retired — middleware also redirects non-player `/signup` paths. */
export default function SignupPage() {
  redirect("/request-access")
}
