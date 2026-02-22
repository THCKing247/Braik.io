"use client"

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

export function AccountSettings({ user }: { user: User }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Account</h2>
      <p className="text-sm text-white/80">{user.email}</p>
    </div>
  )
}
