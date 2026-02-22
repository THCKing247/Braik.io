interface DiagonalStreaksProps {
  className?: string
}

export function DiagonalStreaks({ className = "" }: DiagonalStreaksProps) {
  return (
    <div 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Dark blue streaks - top-left to bottom-right */}
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "2px",
          background: "linear-gradient(135deg, transparent 0%, rgba(30, 58, 138, 0.03) 20%, rgba(30, 58, 138, 0.03) 30%, transparent 50%)",
          top: "10%",
          left: "-30%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "2px",
          background: "linear-gradient(135deg, transparent 0%, rgba(30, 58, 138, 0.025) 25%, rgba(30, 58, 138, 0.025) 35%, transparent 60%)",
          top: "30%",
          left: "-25%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "2px",
          background: "linear-gradient(135deg, transparent 0%, rgba(30, 58, 138, 0.03) 15%, rgba(30, 58, 138, 0.03) 25%, transparent 45%)",
          top: "50%",
          left: "-35%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "2px",
          background: "linear-gradient(135deg, transparent 0%, rgba(30, 58, 138, 0.025) 20%, rgba(30, 58, 138, 0.025) 30%, transparent 50%)",
          top: "70%",
          left: "-30%",
          transform: "rotate(45deg)",
        }}
      />
      
      {/* Light blue streaks - top-left to bottom-right */}
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "1.5px",
          background: "linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.04) 20%, rgba(59, 130, 246, 0.04) 30%, transparent 50%)",
          top: "20%",
          left: "-28%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "1.5px",
          background: "linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.035) 25%, rgba(59, 130, 246, 0.035) 35%, transparent 60%)",
          top: "40%",
          left: "-32%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "1.5px",
          background: "linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.04) 15%, rgba(59, 130, 246, 0.04) 25%, transparent 45%)",
          top: "60%",
          left: "-30%",
          transform: "rotate(45deg)",
        }}
      />
      <div 
        className="absolute"
        style={{
          width: "200%",
          height: "1.5px",
          background: "linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.035) 20%, rgba(59, 130, 246, 0.035) 30%, transparent 50%)",
          top: "80%",
          left: "-25%",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  )
}
