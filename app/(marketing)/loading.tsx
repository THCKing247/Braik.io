/** Lightweight shell during client navigations between marketing routes — no copy, pulse only. */
export default function MarketingLoading() {
  return (
    <div
      className="min-h-screen w-full animate-pulse bg-gradient-to-b from-slate-50 to-white"
      aria-busy="true"
    />
  )
}
