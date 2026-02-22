interface IceTextureProps {
  className?: string
  variant?: "light" | "dark"
}

export function IceTexture({ className = "", variant = "light" }: IceTextureProps) {
  if (variant === "dark") {
    return (
      <div 
        className={`absolute inset-0 pointer-events-none ${className}`}
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {/* Subtle frost accents for dark sections */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-[10%]"
          style={{
            background: `
              linear-gradient(to right, 
              rgba(59, 130, 246, 0.15) 0%,
              rgba(59, 130, 246, 0.08) 30%,
              transparent 100%
            )
          `,
            clipPath: "polygon(0% 0%, 100% 8%, 90% 20%, 100% 35%, 85% 50%, 100% 65%, 90% 80%, 100% 92%, 0% 100%)",
          }}
        />
        <div 
          className="absolute right-0 top-0 bottom-0 w-[10%]"
          style={{
            background: `
              linear-gradient(to left, 
              rgba(59, 130, 246, 0.15) 0%,
              rgba(59, 130, 246, 0.08) 30%,
              transparent 100%
            )
          `,
            clipPath: "polygon(100% 0%, 0% 8%, 10% 20%, 0% 35%, 15% 50%, 0% 65%, 10% 80%, 0% 92%, 100% 100%)",
          }}
        />
      </div>
    )
  }
  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {/* Left Edge - Frost Shards */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-[15%]"
        style={{
          background: `
            linear-gradient(to right, 
              rgba(30, 58, 138, 0.7) 0%,
              rgba(30, 58, 138, 0.5) 20%,
              rgba(59, 130, 246, 0.4) 40%,
              rgba(59, 130, 246, 0.2) 60%,
              transparent 100%
            )
          `,
          clipPath: "polygon(0% 0%, 100% 5%, 95% 15%, 100% 25%, 90% 35%, 100% 45%, 95% 55%, 100% 65%, 90% 75%, 100% 85%, 95% 95%, 100% 100%, 0% 100%)",
        }}
      />
      
      {/* Right Edge - Frost Shards */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-[15%]"
        style={{
          background: `
            linear-gradient(to left, 
              rgba(30, 58, 138, 0.7) 0%,
              rgba(30, 58, 138, 0.5) 20%,
              rgba(59, 130, 246, 0.4) 40%,
              rgba(59, 130, 246, 0.2) 60%,
              transparent 100%
            )
          `,
          clipPath: "polygon(100% 0%, 0% 5%, 5% 15%, 0% 25%, 10% 35%, 0% 45%, 5% 55%, 0% 65%, 10% 75%, 0% 85%, 5% 95%, 0% 100%, 100% 100%)",
        }}
      />
      
      {/* Top Edge Accents */}
      <div 
        className="absolute top-0 left-[10%] right-[10%] h-[8%]"
        style={{
          background: `
            linear-gradient(to bottom, 
              rgba(59, 130, 246, 0.6) 0%,
              rgba(59, 130, 246, 0.3) 30%,
              transparent 100%
            )
          `,
          clipPath: "polygon(0% 0%, 15% 100%, 25% 80%, 35% 100%, 45% 70%, 55% 100%, 65% 85%, 75% 100%, 85% 90%, 100% 100%, 100% 0%)",
        }}
      />
      
      {/* Bottom Edge Accents */}
      <div 
        className="absolute bottom-0 left-[10%] right-[10%] h-[8%]"
        style={{
          background: `
            linear-gradient(to top, 
              rgba(59, 130, 246, 0.6) 0%,
              rgba(59, 130, 246, 0.3) 30%,
              transparent 100%
            )
          `,
          clipPath: "polygon(0% 100%, 15% 0%, 25% 20%, 35% 0%, 45% 30%, 55% 0%, 65% 15%, 75% 0%, 85% 10%, 100% 0%, 100% 100%)",
        }}
      />
      
      {/* Crystalline Accent Elements - Scattered */}
      <div 
        className="absolute top-[20%] left-[5%] w-[120px] h-[120px]"
        style={{
          background: "rgba(59, 130, 246, 0.5)",
          clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
          filter: "blur(8px)",
        }}
      />
      
      <div 
        className="absolute top-[60%] right-[8%] w-[80px] h-[80px]"
        style={{
          background: "rgba(30, 58, 138, 0.6)",
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
          filter: "blur(6px)",
        }}
      />
      
      <div 
        className="absolute bottom-[25%] left-[12%] w-[100px] h-[100px]"
        style={{
          background: "rgba(59, 130, 246, 0.4)",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          filter: "blur(10px)",
        }}
      />
    </div>
  )
}
