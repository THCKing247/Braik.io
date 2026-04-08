"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

export interface QrCodeImageProps {
  /** String to encode (typically a full HTTPS URL). */
  value: string
  /** Pixel width/height of the square image. */
  size?: number
  className?: string
}

/**
 * Renders a QR code as a PNG data-URL image. Suitable for scanning and download.
 */
export function QrCodeImage({ value, size = 220, className }: QrCodeImageProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!value.trim()) {
      setSrc(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return (
      <div
        className={`rounded-xl bg-muted animate-pulse ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode; no optimization benefit
    <img src={src} alt="" width={size} height={size} className={`rounded-xl border border-border ${className ?? ""}`} />
  )
}

/** Same generator as the image; use for PNG download without duplicating options. */
export async function qrCodeToDataUrl(value: string, size = 512): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#FFFFFF" },
  })
}
