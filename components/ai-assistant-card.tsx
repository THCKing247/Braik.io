"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function AIAssistantCard() {
  const handleOpenAI = () => {
    const widget = document.querySelector('[data-ai-widget]') as HTMLElement
    if (widget) {
      widget.click()
    }
  }

  return (
    <Card 
      className="border"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "rgb(var(--border))",
        borderWidth: "1px",
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl" style={{ color: "rgb(var(--text))" }}>
          <Sparkles className="h-6 w-6" style={{ color: "rgb(var(--accent))" }} />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "rgb(var(--text2))" }}>
          Ask me anything about your team, schedule, or get help with tasks.
        </p>
        <Button 
          variant="outline" 
          className="w-full font-athletic uppercase tracking-wide" 
          style={{ 
            borderColor: "rgb(var(--accent))", 
            color: "rgb(var(--accent))",
            backgroundColor: "transparent"
          }}
          onClick={handleOpenAI}
        >
          Open AI Chat
        </Button>
      </CardContent>
    </Card>
  )
}
