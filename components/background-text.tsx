interface BackgroundTextProps {
  text: string
  variant?: "light" | "dark"
  className?: string
}

export function BackgroundText({ text, variant = "light", className = "" }: BackgroundTextProps) {
  const textColor = variant === "dark" 
    ? "rgba(255, 255, 255, 0.025)" 
    : "rgba(33, 37, 41, 0.025)"
  
  return (
    <div 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <div 
        className="absolute font-athletic font-bold uppercase whitespace-nowrap"
        style={{
          fontSize: "clamp(8rem, 20vw, 16rem)",
          lineHeight: "1",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          letterSpacing: "0.05em",
          color: textColor,
        }}
      >
        {text}
      </div>
    </div>
  )
}
