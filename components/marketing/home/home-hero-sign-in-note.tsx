import Link from "next/link"

export function HomeHeroSignInNote() {
  return (
    <div className="border-t border-white/20 pt-14">
      <p className="text-sm font-medium text-slate-300">
        Returning to Braik?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-200 underline decoration-blue-300/60 underline-offset-4 transition hover:text-slate-100 hover:decoration-slate-200"
        >
          Sign in here
        </Link>
      </p>
    </div>
  )
}
