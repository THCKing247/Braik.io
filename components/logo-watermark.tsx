import Image from "next/image"

interface LogoWatermarkProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  className?: string
}

export function LogoWatermark({ position = "top-right", className = "" }: LogoWatermarkProps) {
  const positionClasses = {
    "top-left": "top-0 left-0 -translate-x-1/4 -translate-y-1/4",
    "top-right": "top-0 right-0 translate-x-1/4 -translate-y-1/4",
    "bottom-left": "bottom-0 left-0 -translate-x-1/4 translate-y-1/4",
    "bottom-right": "bottom-0 right-0 translate-x-1/4 translate-y-1/4",
  }

  return (
    <div 
      className={`absolute ${positionClasses[position]} pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ zIndex: 1 }}
    >
      <Image
        src="/braik-logo.png"
        alt=""
        width={800}
        height={400}
        className="w-auto h-auto"
        style={{
          maxWidth: "min(40vw, 600px)",
          height: "auto",
          opacity: 0.65,
        }}
        unoptimized
      />
    </div>
  )
}
