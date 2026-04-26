import { redirect } from "next/navigation"

/** Legacy sibling URL — canonical Playbooks live under the unified Film hub. */
export default function PlayerPrepPlaybooksLegacyRedirect({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film/playbooks`)
}
