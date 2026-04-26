import { redirect } from "next/navigation"

export default function PlayerPrepIndexPage({ params }: { params: { accountId: string } }) {
  redirect(`/player/${encodeURIComponent(params.accountId)}/prep/film`)
}
