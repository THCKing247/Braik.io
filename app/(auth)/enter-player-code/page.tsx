import { redirect } from "next/navigation"

/** Alias for parent player-code signup; canonical flow lives at `/parent/join`. */
export default function EnterPlayerCodePage() {
  redirect("/parent/join")
}
