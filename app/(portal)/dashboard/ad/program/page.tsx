import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** Legacy route: football program staffing lives on the Coaches tab. */
export default function AdProgramRedirectPage() {
  redirect("/dashboard/ad/coaches")
}
