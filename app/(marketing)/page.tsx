import { redirect } from "next/navigation"

/**
 * Beta testing entry point: `/` redirects immediately to `/login`.
 * The marketing landing page is preserved at `/landing`.
 * To restore the public homepage, revert this file to the prior marketing page content.
 */
export default function Home() {
  redirect("/login")
}
