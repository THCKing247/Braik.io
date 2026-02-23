import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect("/login")
  }

  // Check if user is Platform Owner
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPlatformOwner: true },
  })

  if (!user?.isPlatformOwner) {
    redirect("/dashboard")
  }

  // Get program count and user count for overview
  const [programCount, userCount] = await Promise.all([
    prisma.team.count(),
    prisma.user.count(),
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Platform Administration</h1>
        <p style={{ color: "#6B7280" }}>Manage programs, users, and platform settings</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{programCount}</div>
            <p className="text-sm text-gray-600 mt-1">Total programs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{userCount}</div>
            <p className="text-sm text-gray-600 mt-1">Total users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">—</div>
            <p className="text-sm text-gray-600 mt-1">Use API endpoints</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Sections */}
      <div className="space-y-6">
        {/* Program Management */}
        <Card>
          <CardHeader>
            <CardTitle>Program Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View and manage all programs. Adjust billing, enable/disable AI, and handle program lifecycle.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available API Endpoints:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/programs</code> - List all programs</li>
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/programs/[programId]</code> - Get program details</li>
                <li><code className="bg-gray-100 px-1 rounded">PATCH /api/admin/programs/[programId]</code> - Update program</li>
                <li><code className="bg-gray-100 px-1 rounded">PATCH /api/admin/programs/[programId]/billing</code> - Adjust billing</li>
                <li><code className="bg-gray-100 px-1 rounded">PATCH /api/admin/programs/[programId]/ai</code> - Enable/disable AI</li>
                <li><code className="bg-gray-100 px-1 rounded">POST /api/admin/programs/[programId]/archive</code> - Archive program</li>
                <li><code className="bg-gray-100 px-1 rounded">DELETE /api/admin/programs/[programId]</code> - Hard delete program</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Full UI for program management will be implemented in a future update. Use API endpoints for now.
            </p>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Manage users, view user details, and handle user lifecycle operations.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available API Endpoints:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/users</code> - List all users</li>
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/users/[userId]</code> - Get user details</li>
                <li><code className="bg-gray-100 px-1 rounded">PATCH /api/admin/users/[userId]</code> - Update user</li>
                <li><code className="bg-gray-100 px-1 rounded">POST /api/admin/users/[userId]/sessions/revoke</code> - Force logout</li>
                <li><code className="bg-gray-100 px-1 rounded">POST /api/admin/users/[userId]/archive</code> - Archive user</li>
                <li><code className="bg-gray-100 px-1 rounded">DELETE /api/admin/users/[userId]</code> - Hard delete user</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Full UI for user management will be implemented in a future update. Use API endpoints for now.
            </p>
          </CardContent>
        </Card>

        {/* Message Viewing (Dispute Resolution) */}
        <Card>
          <CardHeader>
            <CardTitle>Message Viewing (Dispute Resolution)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View message threads and search messages for dispute resolution purposes.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available API Endpoints:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/messages/threads/[threadId]</code> - View thread</li>
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/messages/search</code> - Search messages</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Full UI for message viewing will be implemented in a future update. Use API endpoints for now.
            </p>
          </CardContent>
        </Card>

        {/* Impersonation */}
        <Card>
          <CardHeader>
            <CardTitle>Impersonation (Read-Only View-As)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Impersonate users in read-only mode to view their experience. Maximum session duration: 1 hour.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available API Endpoints:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">POST /api/admin/impersonate/[userId]</code> - Start impersonation</li>
                <li><code className="bg-gray-100 px-1 rounded">POST /api/admin/impersonate/end</code> - End impersonation</li>
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/impersonate/verify</code> - Verify impersonation status</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Full UI for impersonation will be implemented in a future update. Use API endpoints for now.
            </p>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View audit logs of all admin actions with filtering capabilities.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Available API Endpoints:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">GET /api/admin/audit</code> - View audit logs</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Note: Full UI for audit logs will be implemented in a future update. Use API endpoints for now.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
