import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-bg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-[#1E293B] text-white hover:bg-[#3B82F6] hover:shadow-lg hover:scale-105 shadow-md",
        destructive:
          "bg-[#EF4444] text-white hover:bg-[#EF4444]/90 hover:shadow-lg",
        outline:
          "border-2 border-[#3B82F6] bg-transparent text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white",
        secondary:
          "bg-[#F9FAFB] text-[#111827] hover:bg-[#F3F4F6] hover:shadow-md border border-[#E5E7EB]",
        ghost: "border border-transparent bg-transparent text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white",
        link: "text-[#3B82F6] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

