"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, ArrowRight } from "lucide-react"
import { CollectionDetail } from "./collection-detail"

interface Player {
  id: string
  firstName: string
  lastName: string
}

interface CustomCollection {
  id: string
  title: string
  description: string | null
  amount: number
  status: string
  transactions: Array<{
    id: string
    amount: number
    status: string
  }>
}

interface CollectionsOverviewProps {
  teamId: string
  teamName: string
  players: Player[]
  rosterDuesAmount: number
  rosterDuesPaid: number
  rosterDuesRemaining: number
  rosterDuesStatus: string
  customCollections: CustomCollection[]
}

export function CollectionsOverview({
  teamId,
  teamName,
  players,
  rosterDuesAmount,
  rosterDuesPaid,
  rosterDuesRemaining,
  rosterDuesStatus,
  customCollections,
}: CollectionsOverviewProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedCollectionType, setSelectedCollectionType] = useState<"roster-dues" | "custom" | null>(null)

  // If a collection is selected, show detail view
  if (selectedCollectionId && selectedCollectionType) {
    return (
      <CollectionDetail
        teamId={teamId}
        collectionId={selectedCollectionId}
        collectionType={selectedCollectionType}
        onBack={() => {
          setSelectedCollectionId(null)
          setSelectedCollectionType(null)
        }}
      />
    )
  }

  // Calculate progress for roster dues
  const rosterDuesProgress = rosterDuesAmount > 0 
    ? (rosterDuesPaid / rosterDuesAmount) * 100 
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Collections</h1>
        <p style={{ color: "#6B7280" }}>Track and manage payment collections</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Roster Dues Collection Card */}
        <Card
          className="cursor-pointer hover:shadow-sm transition-all"
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "rgb(var(--border))",
            borderWidth: "1px"
          }}
          onClick={() => {
            setSelectedCollectionId("roster-dues")
            setSelectedCollectionType("roster-dues")
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "rgb(var(--platinum))" }}>
                  <DollarSign className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "rgb(var(--text))" }}>Roster Dues</h3>
                  <p className="text-sm" style={{ color: "rgb(var(--text2))" }}>Per-player subscription</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm" style={{ color: "rgb(var(--text2))" }}>Status</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "rgb(var(--text))" }}
                  >
                    {rosterDuesStatus === "closed" ? "Closed" : "Open"}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm" style={{ color: "rgb(var(--text2))" }}>Amount</span>
                  <span className="font-semibold" style={{ color: "rgb(var(--text))" }}>
                    ${rosterDuesAmount.toFixed(2)}
                  </span>
                </div>
                <div className="w-full rounded-full h-2 mt-2" style={{ backgroundColor: "rgb(var(--alabaster))" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(rosterDuesProgress, 100)}%`,
                      backgroundColor: "rgb(var(--accent))"
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {players.length} players
                  </span>
                  <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    ${rosterDuesPaid.toFixed(2)} / ${rosterDuesAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Collections */}
        {customCollections.map((collection) => {
          const totalCollected = collection.transactions
            .filter((t) => t.status === "completed")
            .reduce((sum, t) => sum + t.amount, 0)
          const progress = collection.amount > 0 
            ? (totalCollected / collection.amount) * 100 
            : 0

          return (
            <Card
              key={collection.id}
              className="cursor-pointer hover:shadow-sm transition-all"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                borderWidth: "1px"
              }}
              onClick={() => {
                setSelectedCollectionId(collection.id)
                setSelectedCollectionType("custom")
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "rgb(var(--platinum))" }}>
                      <DollarSign className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: "rgb(var(--text))" }}>{collection.title}</h3>
                      {collection.description && (
                        <p className="text-sm line-clamp-1" style={{ color: "rgb(var(--text2))" }}>
                          {collection.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm" style={{ color: "rgb(var(--text2))" }}>Status</span>
                      <span
                        className="text-sm font-medium"
                        style={{ color: "rgb(var(--text))" }}
                      >
                        {collection.status === "closed" ? "Closed" : "Open"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm" style={{ color: "rgb(var(--text2))" }}>Amount</span>
                      <span className="font-semibold" style={{ color: "rgb(var(--text))" }}>
                        ${collection.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2 mt-2" style={{ backgroundColor: "rgb(var(--alabaster))" }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: "rgb(var(--accent))"
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                        {collection.transactions.length} transactions
                      </span>
                      <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                        ${totalCollected.toFixed(2)} / ${collection.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {customCollections.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p style={{ color: "rgb(var(--text2))" }}>No custom collections yet</p>
            <p className="text-sm mt-2" style={{ color: "rgb(var(--muted))" }}>
              Create custom collections to track additional payments
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
