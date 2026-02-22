"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, DollarSign, FileText } from "lucide-react"
import { InvoiceList } from "./invoice-list"

interface CollectionDetailProps {
  teamId: string
  collectionId: string
  collectionType: "roster-dues" | "custom"
  onBack: () => void
}

interface CollectionData {
  id: string
  title: string
  description: string | null
  amount: number
  status: string
  totalCollected: number
  totalRemaining: number
  playerCount?: number
}

export function CollectionDetail({
  teamId,
  collectionId,
  collectionType,
  onBack,
}: CollectionDetailProps) {
  const [loading, setLoading] = useState(true)
  const [collection, setCollection] = useState<CollectionData | null>(null)
  const [showInvoices, setShowInvoices] = useState(false)

  useEffect(() => {
    loadCollection()
  }, [teamId, collectionId, collectionType])

  const loadCollection = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/collections/${collectionId}?teamId=${teamId}&type=${collectionType}`
      )
      if (response.ok) {
        const data = await response.json()
        setCollection(data)
      }
    } catch (error) {
      console.error("Failed to load collection:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseCollection = async () => {
    if (!confirm("Are you sure you want to close this collection?")) {
      return
    }

    try {
      const response = await fetch(`/api/collections/${collectionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })

      if (response.ok) {
        alert("Collection closed successfully")
        loadCollection()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to close collection")
      }
    } catch (error) {
      alert("Error closing collection")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardContent className="p-8 text-center">
            <p className="text-white/70">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardContent className="p-8 text-center">
            <p className="text-white/70">Collection not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = collection.amount > 0 
    ? (collection.totalCollected / collection.amount) * 100 
    : 0

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Collections
      </Button>

      {/* Summary Header */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white text-2xl mb-2">{collection.title}</CardTitle>
              {collection.description && (
                <p className="text-white/70">{collection.description}</p>
              )}
            </div>
            <div className="text-right">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  collection.status === "closed"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {collection.status === "closed" ? "Closed" : "Open"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-white/70 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-white">${collection.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-white/70 mb-1">Total Collected</p>
              <p className="text-2xl font-bold text-green-400">${collection.totalCollected.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-white/70 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-red-400">${collection.totalRemaining.toFixed(2)}</p>
            </div>
          </div>

          <div className="w-full bg-white/10 rounded-full h-3 mb-4">
            <div
              className="bg-[#3B82F6] h-3 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {collection.playerCount !== undefined && (
            <p className="text-sm text-white/60">
              {collection.playerCount} players
            </p>
          )}

          <div className="flex gap-4 mt-6 pt-6 border-t border-white/10">
            <Button onClick={() => setShowInvoices(!showInvoices)}>
              <FileText className="h-4 w-4 mr-2" />
              {showInvoices ? "Hide" : "View"} Invoices
            </Button>
            {collection.status === "open" && collectionType === "custom" && (
              <Button variant="outline" onClick={handleCloseCollection}>
                Close Collection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      {showInvoices && (
        <InvoiceList
          teamId={teamId}
          collectionId={collectionId}
          collectionType={collectionType}
        />
      )}
    </div>
  )
}
