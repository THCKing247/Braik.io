import { redirect } from "next/navigation"

/** Legacy route: football program staffing lives on the Coaches tab. */
export default function AdProgramRedirectPage() {
  redirect("/dashboard/ad/coaches")
}
