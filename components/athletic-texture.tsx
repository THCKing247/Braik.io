interface AthleticTextureProps {
  variant?: "streaks-only" | "with-silhouette"
  silhouetteType?: "helmet" | "laces" | "clipboard" | "whistle"
  direction?: "left-to-right" | "right-to-left"
  className?: string
}

export function AthleticTexture({ variant = "streaks-only", silhouetteType, direction = "left-to-right", className = "" }: AthleticTextureProps) {
  const angle = direction === "left-to-right" ? 45 : -45
  const isLeftToRight = direction === "left-to-right"
  
  // Build streak positioning styles
  const getStreakStyle = (topPercent: string, widthPercent: string, offsetPercent: string, height: string = "3px") => {
    const baseStyle: any = {
      top: topPercent,
      width: widthPercent,
      height: height,
      transform: `rotate(${angle}deg)`,
    }
    if (isLeftToRight) {
      baseStyle.left = offsetPercent
      baseStyle.transformOrigin = "0 50%"
    } else {
      baseStyle.right = offsetPercent
      baseStyle.transformOrigin = "100% 50%"
    }
    return baseStyle
  }
  
  return (
    <>
      {/* TEXTURE LAYER - Repeating diagonal pattern across entire section */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          zIndex: 1,
          background: `
            repeating-linear-gradient(
              ${angle}deg,
              transparent 0px,
              transparent 8px,
              rgba(30, 58, 138, 0.75) 8px,
              rgba(30, 58, 138, 0.75) 10px,
              transparent 10px,
              transparent 18px
            ),
            repeating-linear-gradient(
              ${angle}deg,
              transparent 0px,
              transparent 12px,
              rgba(59, 130, 246, 0.75) 12px,
              rgba(59, 130, 246, 0.75) 13px,
              transparent 13px,
              transparent 25px
            )
          `,
        }}
        aria-hidden="true"
      />

      {/* ENERGY LAYER - Bold accent streaks with glow */}
      <div 
        className={`absolute inset-0 pointer-events-none ${className}`}
        style={{ zIndex: 2, overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Accent Streak 1 - Full diagonal across section */}
        <div className="absolute" style={getStreakStyle("20%", "130%", "-15%")}>
          {/* Glow Halo - Light Blue */}
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "0",
              width: "100%",
              height: "12px",
              background: "rgba(59, 130, 246, 0.85)",
              filter: "blur(8px)",
              transform: "translateY(-50%)",
            }}
          />
          {/* Core Line - Dark Blue */}
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              width: "3px",
              height: "100%",
              background: "rgba(30, 58, 138, 0.9)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Accent Streak 2 */}
        <div className="absolute" style={{...getStreakStyle("40%", "136%", "-18%"), height: "2px"}}>
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "0",
              width: "100%",
              height: "10px",
              background: "rgba(59, 130, 246, 0.85)",
              filter: "blur(10px)",
              transform: "translateY(-50%)",
            }}
          />
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              width: "2px",
              height: "100%",
              background: "rgba(30, 58, 138, 0.85)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Accent Streak 3 */}
        <div className="absolute" style={{...getStreakStyle("60%", "130%", "-15%"), height: "4px"}}>
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "0",
              width: "100%",
              height: "14px",
              background: "rgba(59, 130, 246, 0.85)",
              filter: "blur(12px)",
              transform: "translateY(-50%)",
            }}
          />
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              width: "4px",
              height: "100%",
              background: "rgba(30, 58, 138, 1.0)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        {/* Accent Streak 4 */}
        <div className="absolute" style={getStreakStyle("80%", "136%", "-18%")}>
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "0",
              width: "100%",
              height: "11px",
              background: "rgba(59, 130, 246, 0.85)",
              filter: "blur(8px)",
              transform: "translateY(-50%)",
            }}
          />
          <div 
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              width: "3px",
              height: "100%",
              background: "rgba(30, 58, 138, 0.8)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      </div>

      {/* Sports Gear Silhouettes - Limited Use */}
      {variant === "with-silhouette" && silhouetteType && (
        <div className="absolute opacity-[0.02]" style={{ zIndex: 1 }}>
          {silhouetteType === "helmet" && (
            <div 
              className="absolute"
              style={{
                width: "600px",
                height: "600px",
                top: "-100px",
                right: "-150px",
              }}
            >
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 80 Q100 40 150 80 L160 120 Q100 140 40 120 Z" stroke="rgba(30, 58, 138, 1)" strokeWidth="2" fill="none"/>
                <path d="M60 90 Q100 60 140 90" stroke="rgba(30, 58, 138, 1)" strokeWidth="1.5" fill="none"/>
                <path d="M70 100 Q100 80 130 100" stroke="rgba(30, 58, 138, 1)" strokeWidth="1" fill="none"/>
              </svg>
            </div>
          )}
          
          {silhouetteType === "laces" && (
            <div 
              className="absolute"
              style={{
                width: "400px",
                height: "800px",
                top: "-100px",
                left: "-50px",
                transform: "rotate(15deg)",
              }}
            >
              <svg viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 20 L30 40 L25 60 L35 80 L30 100 L40 120 L35 140 L45 160 L40 180" stroke="rgba(59, 130, 246, 1)" strokeWidth="2" fill="none"/>
                <path d="M50 20 L60 40 L55 60 L65 80 L60 100 L70 120 L65 140 L75 160 L70 180" stroke="rgba(59, 130, 246, 1)" strokeWidth="2" fill="none"/>
                <path d="M80 20 L90 40 L85 60 L95 80 L90 100 L100 120 L95 140 L105 160 L100 180" stroke="rgba(59, 130, 246, 1)" strokeWidth="2" fill="none"/>
              </svg>
            </div>
          )}
          
          {silhouetteType === "clipboard" && (
            <div 
              className="absolute"
              style={{
                width: "500px",
                height: "700px",
                bottom: "-100px",
                left: "-100px",
                transform: "rotate(-10deg)",
              }}
            >
              <svg viewBox="0 0 200 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="30" y="20" width="140" height="260" rx="5" stroke="rgba(30, 58, 138, 1)" strokeWidth="2" fill="none"/>
                <rect x="40" y="40" width="120" height="8" stroke="rgba(30, 58, 138, 1)" strokeWidth="1" fill="none"/>
                <rect x="40" y="60" width="100" height="8" stroke="rgba(30, 58, 138, 1)" strokeWidth="1" fill="none"/>
                <rect x="40" y="80" width="110" height="8" stroke="rgba(30, 58, 138, 1)" strokeWidth="1" fill="none"/>
                <circle cx="50" cy="15" r="8" stroke="rgba(30, 58, 138, 1)" strokeWidth="2" fill="none"/>
              </svg>
            </div>
          )}
          
          {silhouetteType === "whistle" && (
            <div 
              className="absolute"
              style={{
                width: "400px",
                height: "400px",
                top: "20%",
                right: "-50px",
                transform: "rotate(-20deg)",
              }}
            >
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 100 Q50 80 80 90 Q110 100 140 95 Q160 90 170 100" stroke="rgba(59, 130, 246, 1)" strokeWidth="3" fill="none"/>
                <circle cx="170" cy="100" r="15" stroke="rgba(59, 130, 246, 1)" strokeWidth="2" fill="none"/>
                <path d="M30 100 L20 110 L25 105 Z" stroke="rgba(59, 130, 246, 1)" strokeWidth="2" fill="none"/>
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  )
}
