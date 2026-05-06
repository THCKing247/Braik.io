"use client"

import { memo, useEffect, useRef, useState } from "react"

/**
 * Image attachments: reserve space, defer bytes until near viewport (IntersectionObserver).
 * Optional smaller `thumbnailSrc` loads first when provided (application-level, no DB requirement).
 * Full-resolution URL is used when no thumbnail or after open-in-new-tab via anchor href.
 */
export const LazyThreadAttachmentImage = memo(function LazyThreadAttachmentImage({
  fullSrc,
  thumbnailSrc,
  alt,
}: {
  /** Authorized GET URL for original file (same-origin API route). */
  fullSrc: string
  /** Optional lighter preview (same auth rules as fullSrc when applicable). */
  thumbnailSrc?: string
  alt: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin: "180px", threshold: 0.01 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const displaySrc = inView ? thumbnailSrc || fullSrc : undefined

  if (failed) {
    return (
      <div className="min-h-28 min-w-28 rounded-lg border border-dashed border-black/15 bg-black/5 px-2 py-2 text-xs text-muted-foreground">
        <p>Preview unavailable</p>
        <a
          href={fullSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-medium text-[rgb(var(--accent))] underline"
        >
          Open file
        </a>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="max-w-full">
      <div className="relative min-h-28 min-w-28 max-w-full">
        {!loaded ? (
          <div
            className={`min-h-28 min-w-28 rounded-lg bg-black/[0.06] ${inView ? "animate-pulse" : ""}`}
            aria-hidden
          />
        ) : null}
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={
              loaded
                ? "relative h-auto max-h-56 w-auto max-w-full rounded-lg border border-black/10"
                : "absolute inset-0 max-h-0 max-w-0 overflow-hidden opacity-0"
            }
            style={loaded ? { maxHeight: "14rem" } : undefined}
          />
        ) : null}
      </div>
      <a
        href={fullSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-[11px] underline underline-offset-2 opacity-90 hover:opacity-100"
      >
        Open original
      </a>
    </div>
  )
})
