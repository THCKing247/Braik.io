export default function PlaybooksLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "rgb(var(--accent))" }}
          aria-hidden
        />
        <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
          Loading Playbooks…
        </p>
      </div>
    </div>
  )
}
