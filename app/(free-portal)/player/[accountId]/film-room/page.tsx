import { redirect } from "next/navigation"

/** Legacy URL — canonical prep hub lives under `/prep/film`. */
export default function PlayerPortalFilmRoomPage({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film`)
}
