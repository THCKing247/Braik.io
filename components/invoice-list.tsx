"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Invoice {
  id: string
  playerName: string
  payerName: string | null
  amountDue: number
  amountPaid: number
  status: "paid" | "partial" | "unpaid"
  date: string
  invoiceId: string
}

interface InvoiceListProps {
  teamId: string
  collectionId: string
  collectionType: "roster-dues" | "custom"
}

export function InvoiceList({ teamId, collectionId, collectionType }: InvoiceListProps) {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [teamId, collectionId, collectionType])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/collections/${collectionId}/invoices?teamId=${teamId}&type=${collectionType}`
      )
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices || [])
      }
    } catch (error) {
      console.error("Failed to load invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-400 bg-green-500/20"
      case "partial":
        return "text-yellow-400 bg-yellow-500/20"
      case "unpaid":
        return "text-red-400 bg-red-500/20"
      default:
        return "text-white/60 bg-white/10"
    }
  }

  if (loading) {
    return (
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardContent className="p-8 text-center">
          <p className="text-white/70">Loading invoices...</p>
        </CardContent>
      </Card>
    )
  }

  if (selectedInvoice) {
    return (
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Invoice Details</CardTitle>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-white/70">Invoice detail view coming soon</p>
            <p className="text-sm text-white/60">
              Detailed invoice information will be displayed here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="text-white">Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/70">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Player</th>
                  <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Payer</th>
                  <th className="text-right py-3 px-4 text-white/70 font-medium text-sm">Amount Due</th>
                  <th className="text-right py-3 px-4 text-white/70 font-medium text-sm">Amount Paid</th>
                  <th className="text-center py-3 px-4 text-white/70 font-medium text-sm">Status</th>
                  <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Date</th>
                  <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Invoice ID</th>
                  <th className="text-center py-3 px-4 text-white/70 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-white">{invoice.playerName}</td>
                    <td className="py-3 px-4 text-white/70">
                      {invoice.payerName || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      ${invoice.amountDue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-white">
                      ${invoice.amountPaid.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          invoice.status
                        )}`}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white/70 text-sm">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-white/60 text-sm font-mono">
                      {invoice.invoiceId}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedInvoice(invoice.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
