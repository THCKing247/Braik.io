import { AdCoachesPageBootstrap } from "@/components/portal/ad/ad-coaches-page-bootstrap"

/**
 * Coaches data loads via GET /api/ad/bootstrap (teams picklist + coach rows + engagement hints).
 * Layout enforces AD portal access; the API returns 403 if that ever regresses.
 */
export default function AdCoachesPage() {
  return <AdCoachesPageBootstrap />
}
