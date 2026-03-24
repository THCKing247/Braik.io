import { redirect } from "next/navigation"

/** Legacy URL: football program controls live under the athletic department portal. */
export default function LegacyDirectorRouteRedirect() {
  redirect("/dashboard/ad/program")
}
