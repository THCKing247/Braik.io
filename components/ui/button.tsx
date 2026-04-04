import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-bg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        /** Primary: dark/navy fill */
        default: "bg-[#0F172A] text-white shadow-sm hover:bg-[#1E293B]",
        destructive:
          "bg-[#EF4444] text-white hover:bg-[#DC2626]",
        signIn:
          "border border-slate-300 bg-white text-[#0F172A] shadow-sm hover:bg-slate-50 hover:border-slate-400",
        /** Secondary: blue outline */
        outline:
          "border border-[#2563EB] bg-transparent text-[#2563EB] hover:bg-[#EFF6FF]",
        secondary:
          "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F1F5F9]",
        ghost: "border border-transparent bg-[#F8FAFC] text-[#334155] hover:bg-[#F1F5F9]",
        link: "text-[#3B82F6] underline-offset-4 hover:underline",
        tertiary: "bg-transparent text-[#334155] hover:bg-[#F1F5F9]",
        icon: "bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]",
        fab: "bg-[#0F172A] text-white shadow-lg hover:bg-[#1E293B]",
      },
      size: {
        default: "h-11 min-h-[44px] px-5 py-2.5",
        touch: "h-11 min-h-[44px] px-5 rounded-xl text-[15px] font-semibold",
        sm: "h-10 min-h-[40px] px-4",
        lg: "h-12 min-h-[48px] px-7 text-base",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
        fab: "h-14 w-14 rounded-full",
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
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

