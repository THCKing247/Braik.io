import { redirect } from "next/navigation"

/** Retired signup payment / completion step for public coach flows. */
export default function PaymentPage() {
  redirect("/request-access")
}
