import { redirect } from "next/navigation"

/** Legacy URL — canonical Playbooks live under the unified Film hub. */
export default function PlayerPortalPlaybooksPage({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film/playbooks`)
}
