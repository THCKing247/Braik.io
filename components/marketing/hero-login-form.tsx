"use client"

import { signIn } from "@/lib/auth/client-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { useId, useState } from "react"
import {
  getParentAccessHref,
  getParentPrimaryCtaLabel,
  getPlayerPrimaryCtaLabel,
  getPlayerSignupHref,
} from "@/lib/marketing/join-cta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"

// unchanged code above...

      } else if (result?.ok) {
        const destination = callbackUrl ?? result.url ?? "/dashboard"
        authTimingClient("login_client_navigate_start", { destination })
        router.replace(destination)
        return
      } else {

// rest unchanged
