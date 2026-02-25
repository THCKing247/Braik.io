"use client"

import { useState } from "react"
import { SubscriptionManager } from "@/components/subscription-manager"
import { PaymentsManager } from "@/components/payments-manager"
import { CoachPaymentsManager } from "@/components/coach-payments-manager"
import { CollectionsOverview } from "@/components/collections-overview"
import { CreditCard, DollarSign, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

type InvoiceTab = "subscription" | "payments" | "collections"

interface InvoicePageClientProps {
  team: any
  players: any[]
  membership: any
  collections: any[]
  currentUserId: string
  userRole: string
  positionGroups?: string[] | null
}

export function InvoicePageClient({
  team,
  players,
  membership,
  collections,
  currentUserId,
  userRole,
  positionGroups,
}: InvoicePageClientProps) {
  const [activeTab, setActiveTab] = useState<InvoiceTab>("subscription")

  const isHeadCoach = userRole === "HEAD_COACH"
  const playerCount = players.length
  const subscriptionAmount = playerCount * 5.0
  const remainingBalance = subscriptionAmount - (team.amountPaid || 0)

  // Calculate roster dues collection info
  const rosterDuesAmount = team.duesAmount * playerCount
  const rosterDuesPaid = team.amountPaid || 0
  const rosterDuesRemaining = rosterDuesAmount - rosterDuesPaid

  const tabs: Array<{ id: InvoiceTab; label: string; icon: any; visible: boolean }> = [
    {
      id: "subscription",
      label: "Subscription",
      icon: CreditCard,
      visible: isHeadCoach,
    },
    {
      id: "payments",
      label: "Payments",
      icon: DollarSign,
      visible: isHeadCoach || userRole === "PLAYER" || userRole === "PARENT",
    },
    {
      id: "collections",
      label: "Collections",
      icon: Receipt,
      visible: isHeadCoach,
    },
  ]

  const visibleTabs = tabs.filter((tab) => tab.visible)

  const renderContent = () => {
    switch (activeTab) {
      case "subscription":
        return (
          <SubscriptionManager
            team={team}
            playerCount={playerCount}
            subscriptionAmount={subscriptionAmount}
            amountPaid={team.amountPaid || 0}
            remainingBalance={remainingBalance}
            subscriptionPaid={team.subscriptionPaid || false}
            isHeadCoach={isHeadCoach}
            teamIdCode={team.teamIdCode || ""}
          />
        )
      case "payments":
        return (
          <div className="space-y-8">
            {/* Platform Payments (Season Dues) */}
            <div>
              <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111827" }}>
                Season Dues
              </h2>
              <PaymentsManager
                team={team}
                players={players}
                membership={membership}
                currentUserId={currentUserId}
              />
            </div>

            {/* Coach-Collected Payments */}
            {isHeadCoach && (
              <div>
                <h2 className="text-2xl font-semibold mb-4" style={{ color: "#111827" }}>
                  Coach-Collected Payments
                </h2>
                <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
                  Payments for gear, camps, fundraisers, and other custom fees collected by the coach
                </p>
                <CoachPaymentsManager teamId={team.id} isHeadCoach={isHeadCoach} />
              </div>
            )}
          </div>
        )
      case "collections":
        return (
          <CollectionsOverview
            teamId={team.id}
            teamName={team.name}
            players={players}
            rosterDuesAmount={rosterDuesAmount}
            rosterDuesPaid={rosterDuesPaid}
            rosterDuesRemaining={rosterDuesRemaining}
            rosterDuesStatus={team.subscriptionPaid ? "closed" : "open"}
            customCollections={collections}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Invoice</h1>
        <p style={{ color: "#6B7280" }}>Manage subscription, payments, and collections</p>
      </div>

      {/* Tabs */}
      <div className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
        <nav className="flex space-x-8">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">{renderContent()}</div>
    </div>
  )
}
