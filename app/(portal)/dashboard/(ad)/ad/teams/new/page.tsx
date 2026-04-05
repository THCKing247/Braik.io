import { redirect } from "next/navigation"

/** Manual AD team creation removed (Phase 4); teams come from signup/provisioning. */
export default function AdTeamsNewPage() {
  redirect("/dashboard/ad/teams")
}
