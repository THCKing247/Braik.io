interface SectionDividerProps {
  variant?: "thick" | "offset" | "asymmetric"
  className?: string
}

export function SectionDivider({ variant = "thick", className = "" }: SectionDividerProps) {
  if (variant === "thick") {
    return (
      <div className={`w-full h-px bg-[#212529] opacity-10 ${className}`} />
    )
  }
  
  if (variant === "offset") {
    return (
      <div className={`relative ${className}`}>
        <div className="w-3/4 h-[2px] bg-[#212529] opacity-10 ml-auto" />
      </div>
    )
  }
  
  if (variant === "asymmetric") {
    return (
      <div className={`relative ${className}`}>
        <div className="w-2/3 h-[3px] bg-[#212529] opacity-15" />
        <div className="w-1/3 h-[1px] bg-[#212529] opacity-10 ml-auto -mt-[2px]" />
      </div>
    )
  }
  
  return null
}
