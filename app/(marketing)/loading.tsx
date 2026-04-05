/** Lightweight shell during client navigations between marketing routes (perceived responsiveness). */
export default function MarketingLoading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading">
      <div className="h-14 animate-pulse bg-slate-100 md:h-16" />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-6">
        <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-slate-100" />
        <div className="h-36 w-full animate-pulse rounded-xl bg-slate-50" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-slate-50" />
      </div>
    </div>
  )
}
