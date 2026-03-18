"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCoachB } from "@/components/portal/coach-b-context"
import { Sparkles } from "lucide-react"

export function AIAssistantCard() {
  const coachB = useCoachB()

  const handleOpenAI = () => {
    coachB?.open()
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
          Coach B
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
          Chat with Coach B
        </Button>
      </CardContent>
    </Card>
  )
}
