import { redirect } from "next/navigation"

/** Legacy sibling URL — canonical Study lives under the unified Film hub. */
export default function PlayerPrepStudyLegacyRedirect({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film/study`)
}
