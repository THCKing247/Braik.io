import { cn } from "@/lib/utils"

type SectionImagePlaceholderProps = {
  /** Default 4:3; use `video` for wider placeholders. */
  aspect?: "4/3" | "video"
  className?: string
}

export function SectionImagePlaceholder({
  aspect = "4/3",
  className,
}: SectionImagePlaceholderProps) {
  const aspectClass = aspect === "video" ? "aspect-video" : "aspect-[4/3]"

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-md",
        aspectClass,
        className
      )}
    >
      <div className="px-4 text-center">
        <p className="text-sm font-semibold !text-slate-900">Image Placeholder</p>
        <p className="mt-1 text-xs text-slate-600">Replace with product screenshot or photo</p>
      </div>
    </div>
  )
}
