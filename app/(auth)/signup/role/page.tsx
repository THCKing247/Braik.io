import { redirect } from "next/navigation"

/** Role picker for retired public signup — middleware also redirects non-player `/signup` paths. */
export default function RoleSelectionPage() {
  redirect("/request-access")
}
