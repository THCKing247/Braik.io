import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DocumentsManager } from "@/components/documents-manager"

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  // Get documents with proper permission filtering
  const { getDocumentPermissions, canViewDocument } = await import("@/lib/documents-permissions")
  const permissions = await getDocumentPermissions(
    {
      userId: session.user.id,
      role: membership.role,
      permissions: membership.permissions,
      positionGroups: membership.positionGroups,
    },
    membership.teamId
  )

  // Fetch all documents and filter by permissions
  // Exclude playbooks - they are now in their own tool
  const allDocuments = await prisma.document.findMany({
    where: { 
      teamId: membership.teamId,
      category: { not: "playbook" } // Exclude playbooks
    },
    include: {
      creator: { select: { name: true, email: true } },
      acknowledgements: {
        where: { userId: session.user.id },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Filter documents based on permissions
  const documents = []
  for (const doc of allDocuments) {
    const canView = await canViewDocument(
      {
        userId: session.user.id,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.positionGroups,
      },
      membership.teamId,
      doc
    )
    if (canView) {
      documents.push(doc)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Documents & Resources</h1>
        <p style={{ color: "#6B7280" }}>Team rules, policies, waivers, forms, and administrative documents</p>
      </div>
      <DocumentsManager 
        teamId={membership.teamId} 
        documents={documents} 
        canUpload={permissions.canCreate}
        userRole={membership.role}
      />
    </div>
  )
}

