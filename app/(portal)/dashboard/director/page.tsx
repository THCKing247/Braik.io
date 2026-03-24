import { redirect } from "next/navigation"

/** Legacy URL: football program staffing lives under AD portal → Coaches. */
export default function LegacyDirectorRouteRedirect() {
  redirect("/dashboard/ad/coaches")
}
