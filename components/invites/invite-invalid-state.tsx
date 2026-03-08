import Link from "next/link"

type Reason = "not_found" | "expired" | "already_accepted"

interface InviteInvalidStateProps {
  reason: Reason
}

const content: Record<Reason, { title: string; description: string }> = {
  not_found: {
    title: "Invitation not found",
    description: "This invite link is invalid or may have been removed.",
  },
  expired: {
    title: "Invitation expired",
    description: "This invite has expired. Please ask your athletic director or coach for a new invitation.",
  },
  already_accepted: {
    title: "Invitation already accepted",
    description: "This invite has already been used. You can sign in to access your team.",
  },
}

export function InviteInvalidState({ reason }: InviteInvalidStateProps) {
  const { title, description } = content[reason]

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-bold text-[#212529]">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">{description}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            Go to sign in
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#6B7280] hover:text-[#212529]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
