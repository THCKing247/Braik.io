import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "card rounded-2xl transition-all duration-250",
      className
    )}
    style={{
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: "16px",
      boxShadow: `
        0 1px 2px rgba(0, 0, 0, 0.04),
        0 8px 24px rgba(11, 42, 91, 0.08)
      `,
      color: "rgb(var(--text))",
      ...(props.style || {}),
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)"
      e.currentTarget.style.boxShadow = `
        0 4px 8px rgba(0, 0, 0, 0.05),
        0 14px 36px rgba(11, 42, 91, 0.12)
      `
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)"
      e.currentTarget.style.boxShadow = `
        0 1px 2px rgba(0, 0, 0, 0.04),
        0 8px 24px rgba(11, 42, 91, 0.08)
      `
    }}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-athletic font-semibold leading-none tracking-wide uppercase text-[#0F172A]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#6B7280]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

