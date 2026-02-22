"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AIAssistant({ teamId }: { teamId: string }) {
  const [intent, setIntent] = useState("draft")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError("Please provide input")
      return
    }

    setLoading(true)
    setError("")
    setOutput("")

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, intent, input }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "AI service error")
      }

      setOutput(data.output)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Note: API key check happens server-side

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What would you like help with?</Label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="draft">Draft Message</option>
                <option value="summarize">Summarize</option>
                <option value="reminders">Generate Reminders</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>
                {intent === "draft" && "What should the message be about?"}
                {intent === "summarize" && "Paste content to summarize"}
                {intent === "reminders" && "What reminders do you need?"}
              </Label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex min-h-[120px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                placeholder={
                  intent === "draft"
                    ? "e.g., Practice cancelled due to weather"
                    : intent === "summarize"
                    ? "Paste long text here..."
                    : "e.g., Unpaid dues, missing forms"
                }
              />
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Processing..." : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-text">{output}</div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                navigator.clipboard.writeText(output)
                alert("Copied to clipboard!")
              }}
            >
              Copy
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

