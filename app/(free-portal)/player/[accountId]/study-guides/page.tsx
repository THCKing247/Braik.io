import { redirect } from "next/navigation"

/** Legacy URL — canonical Study lives under the unified Film hub. */
export default function PlayerPortalStudyGuidesPage({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film/study`)
}
