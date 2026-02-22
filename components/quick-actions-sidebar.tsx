"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { getQuickActionsForRole } from "@/config/quickActions"
import { cn } from "@/lib/utils"

export function QuickActionsSidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const userRole = session?.user?.role
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  const quickActions = getQuickActionsForRole(userRole)

  const ToolbarItem = ({ 
    href, 
    icon: Icon, 
    label, 
    itemId,
    index
  }: { 
    href: string
    icon: any
    label: string
    itemId: string
    index: number
  }) => {
    const itemRef = useRef<HTMLDivElement>(null)
    const [hoveredPosition, setHoveredPosition] = useState<{ top: number; left: number } | null>(null)
    const isHovered = hoveredItem === itemId
    const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
    
    useEffect(() => {
      if (isHovered && itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect()
        setHoveredPosition({ top: rect.top, left: rect.left })
      } else {
        setHoveredPosition(null)
      }
    }, [isHovered])
    
    return (
      <div 
        ref={itemRef}
        className="relative"
        style={{ 
          width: '56px',
          height: '56px',
        }}
        onMouseEnter={() => setHoveredItem(itemId)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Icon box - base size */}
        <Link 
          href={href} 
          className="block no-underline"
        >
          <Card 
            className={cn(
              "cursor-pointer transition-all duration-200 border flex items-center justify-center",
              isActive && "ring-2"
            )}
            style={{
              backgroundColor: isActive ? "rgb(var(--platinum))" : "#FFFFFF",
              borderColor: isActive ? "rgb(var(--accent))" : "rgb(var(--border))",
              borderWidth: isActive ? "2px" : "1px",
              width: '56px',
              height: '56px',
              minWidth: '56px',
              minHeight: '56px',
              position: 'relative',
              zIndex: 10001,
            }}
          >
            <CardContent className="p-0 flex items-center justify-center" style={{ padding: 0 }}>
              <Icon 
                className="h-5 w-5 flex-shrink-0" 
                style={{ 
                  color: isActive ? "rgb(var(--accent))" : "rgb(var(--text2))",
                  strokeWidth: 2
                }} 
              />
            </CardContent>
          </Card>
        </Link>
        
        {/* Expanded label - overlays body content on hover, rendered at root level */}
        {isHovered && hoveredPosition && (
          <div
            style={{
              position: 'fixed',
              left: `${hoveredPosition.left}px`,
              top: `${hoveredPosition.top}px`,
              zIndex: 99999,
              pointerEvents: 'none',
            }}
          >
            <Link 
              href={href} 
              className="block no-underline"
              style={{ pointerEvents: 'auto' }}
            >
              <Card 
                className={cn(
                  "cursor-pointer transition-all duration-200 border flex items-center overflow-hidden",
                  isActive && "ring-2"
                )}
                style={{
                  backgroundColor: isActive ? "rgb(var(--platinum))" : "#FFFFFF",
                  borderColor: isActive ? "rgb(var(--accent))" : "rgb(var(--border))",
                  borderWidth: isActive ? "2px" : "1px",
                  width: 'auto',
                  height: '56px',
                  minWidth: '56px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                }}
              >
                <CardContent className="p-0 flex items-center gap-3" style={{ padding: 0, paddingLeft: '12px', paddingRight: '12px' }}>
                  <Icon 
                    className="h-5 w-5 flex-shrink-0" 
                    style={{ 
                      color: isActive ? "rgb(var(--accent))" : "rgb(var(--text2))",
                      strokeWidth: 2
                    }} 
                  />
                  <span 
                    className="qa-label text-sm font-medium whitespace-nowrap"
                    style={{ 
                      color: isActive ? "rgb(var(--accent))" : "rgb(var(--text))"
                    }}
                  >
                    {label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>
    )
  }

  if (quickActions.length === 0) {
    return null
  }

  return (
    <>
      {/* Toolbar container - fixed 56px gutter, icons stay within gutter */}
      <div 
        className="quick-actions flex flex-col py-4 px-2"
        style={{
          backgroundColor: "rgb(var(--snow))", // Background for gutter
          zIndex: 99999,
          minWidth: '56px',
          maxWidth: '56px', // Fixed width, never expands
          overflowY: 'visible',
          overflowX: 'visible', // Allow expanded labels to overflow right
          alignItems: 'flex-start',
          isolation: 'auto', // Ensure proper stacking context
          height: 'calc(100vh - 70px)', // Full height minus nav
          justifyContent: 'flex-start',
        }}
      >
        <div className="space-y-2 w-full flex flex-col" style={{ position: 'relative', zIndex: 99999 }}>
          {quickActions.map((action, index) => (
            <ToolbarItem
              key={action.id}
              href={action.href}
              icon={action.icon}
              label={action.label}
              itemId={action.id}
              index={index}
            />
          ))}
        </div>
      </div>
    </>
  )
}
