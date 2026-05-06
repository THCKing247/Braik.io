"use client"

import { memo, useState } from "react"

export const LazyThreadAttachmentImage = memo(function LazyThreadAttachmentImage({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) return null

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      {!loaded ? <div className="h-28 w-28 animate-pulse rounded-lg bg-black/10" aria-hidden /> : null}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={loaded ? "h-auto max-h-56 w-auto max-w-full rounded-lg border border-black/10" : "hidden"}
      />
    </a>
  )
})
