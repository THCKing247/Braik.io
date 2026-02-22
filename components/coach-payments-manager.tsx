"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign, Plus, CreditCard, CheckCircle, XCircle, Edit, Trash2 } from "lucide-react"
import { format } from "date-fns"

interface PaymentAccount {
  connected: boolean
  status: string
  provider?: string
  account?: any
}

interface PaymentCollection {
  id: string
  title: string
  description?: string | null
  amount: number
  dueDate?: string | null
  visibility: string
  status: string
  createdAt: string
  creator: {
    name: string | null
    email: string
  }
  _count?: {
    transactions: number
  }
}

interface CoachPaymentsManagerProps {
  teamId: string
  isHeadCoach: boolean
}

export function CoachPaymentsManager({ teamId, isHeadCoach }: CoachPaymentsManagerProps) {
  const [account, setAccount] = useState<PaymentAccount | null>(null)
  const [collections, setCollections] = useState<PaymentCollection[]>([])
  const [loading, setLoading] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [editingCollection, setEditingCollection] = useState<PaymentCollection | null>(null)

  const [collectionForm, setCollectionForm] = useState({
    title: "",
    description: "",
    amount: "",
    dueDate: "",
    visibility: "PARENTS_AND_TEAM",
  })

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    if (!isHeadCoach) return

    try {
      const [accountRes, collectionsRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/payments/coach/status`),
        fetch(`/api/teams/${teamId}/payments/coach/collections`),
      ])

      if (accountRes.ok) {
        const accountData = await accountRes.json()
        setAccount(accountData)
      }

      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json()
        setCollections(collectionsData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/payments/coach/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "stripe" }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to connect account")
      }

      const data = await response.json()
      alert(
        "Payment account connection initiated. In production, you would be redirected to complete the onboarding process."
      )
      loadData()
      setShowConnectForm(false)
    } catch (error: any) {
      alert(error.message || "Error connecting account")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectionForm.title || !collectionForm.amount) {
      alert("Title and amount are required")
      return
    }

    setLoading(true)
    try {
      const url = editingCollection
        ? `/api/teams/${teamId}/payments/coach/collections/${editingCollection.id}`
        : `/api/teams/${teamId}/payments/coach/collections`
      const method = editingCollection ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectionForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save collection")
      }

      loadData()
      resetForm()
    } catch (error: any) {
      alert(error.message || "Error saving collection")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/teams/${teamId}/payments/coach/collections/${collectionId}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Failed to delete collection")
      }

      loadData()
    } catch (error) {
      alert("Error deleting collection")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setCollectionForm({
      title: "",
      description: "",
      amount: "",
      dueDate: "",
      visibility: "PARENTS_AND_TEAM",
    })
    setEditingCollection(null)
    setShowCollectionForm(false)
  }

  const handleEdit = (collection: PaymentCollection) => {
    setEditingCollection(collection)
    setCollectionForm({
      title: collection.title,
      description: collection.description || "",
      amount: collection.amount.toString(),
      dueDate: collection.dueDate ? format(new Date(collection.dueDate), "yyyy-MM-dd") : "",
      visibility: collection.visibility,
    })
    setShowCollectionForm(true)
  }

  if (!isHeadCoach) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted">
          Only head coaches can manage coach-collected payments.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Payment Account Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Account
          </CardTitle>
          <CardDescription>
            Connect your bank account or card to collect payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium">Account Connected</p>
                  <p className="text-sm text-text-2">
                    Provider: {account.provider || "Stripe"} • Status: {account.status}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-muted" />
                <p className="text-text-2">No payment account connected</p>
              </div>
              {!showConnectForm ? (
                <Button onClick={() => setShowConnectForm(true)}>
                  Connect Payment Account
                </Button>
              ) : (
                <div className="space-y-4 p-4 border rounded-lg">
                  <p className="text-sm text-text-2">
                    Connect your Stripe account to start collecting payments. In production, this
                    would redirect you to Stripe Connect onboarding.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleConnect} disabled={loading}>
                      Connect with Stripe
                    </Button>
                    <Button variant="outline" onClick={() => setShowConnectForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Collections */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Payment Collections</h2>
        {account?.connected && (
          <Button onClick={() => setShowCollectionForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Collection
          </Button>
        )}
      </div>

      {showCollectionForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCollection ? "Edit Collection" : "New Payment Collection"}</CardTitle>
            <CardDescription>
              Create a payment collection for gear, camps, fundraisers, or custom fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={collectionForm.title}
                  onChange={(e) =>
                    setCollectionForm({ ...collectionForm, title: e.target.value })
                  }
                  placeholder="e.g., Team Gear, Camp Fee, Fundraiser"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={collectionForm.description}
                  onChange={(e) =>
                    setCollectionForm({ ...collectionForm, description: e.target.value })
                  }
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  placeholder="Additional details about this payment..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={collectionForm.amount}
                    onChange={(e) =>
                      setCollectionForm({ ...collectionForm, amount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={collectionForm.dueDate}
                    onChange={(e) =>
                      setCollectionForm({ ...collectionForm, dueDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <select
                  id="visibility"
                  value={collectionForm.visibility}
                  onChange={(e) =>
                    setCollectionForm({ ...collectionForm, visibility: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <option value="PARENTS_AND_TEAM">Parents and Team</option>
                  <option value="TEAM">Team Only</option>
                  <option value="COACHES_ONLY">Coaches Only</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingCollection ? "Update" : "Create"} Collection
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Collections List */}
      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted" />
            <p>No payment collections yet</p>
            {account?.connected && (
              <Button onClick={() => setShowCollectionForm(true)} className="mt-4">
                Create Your First Collection
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {collections.map((collection) => (
            <Card key={collection.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{collection.title}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          collection.status === "open"
                            ? "bg-surface-2 text-success border border-success"
                            : "bg-surface-2 text-text-2"
                        }`}
                      >
                        {collection.status}
                      </span>
                    </div>
                    {collection.description && (
                      <p className="text-sm text-muted mb-2">{collection.description}</p>
                    )}
                    <div className="text-sm text-muted space-y-1">
                      <p>
                        <span className="font-medium">Amount:</span> ${collection.amount}
                      </p>
                      {collection.dueDate && (
                        <p>
                          <span className="font-medium">Due Date:</span>{" "}
                          {format(new Date(collection.dueDate), "MMM d, yyyy")}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Visibility:</span>{" "}
                        {collection.visibility.replace("_", " ")}
                      </p>
                      {collection._count && (
                        <p>
                          <span className="font-medium">Payments:</span>{" "}
                          {collection._count.transactions}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(collection)}
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCollection(collection.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
