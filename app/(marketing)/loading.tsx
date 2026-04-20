import { LoadingState } from "@/components/ui/loading-state"

/** Lightweight shell during client navigations between marketing routes (perceived responsiveness). */
export default function MarketingLoading() {
  return <LoadingState label="Loading" minHeightClassName="min-h-screen" size="lg" />
}
