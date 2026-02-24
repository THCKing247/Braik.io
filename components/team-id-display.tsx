"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TeamIdDisplayProps {
  teamIdCode: string
  players: Array<{
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    uniqueCode: string | null
  }>
  teamId: string
}

export function TeamIdDisplay({ teamIdCode, players, teamId }: TeamIdDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("")

  useEffect(() => {
    // Generate QR code using a QR code API (using qr-server.com as a simple solution)
    if (teamIdCode && teamIdCode.trim() !== "") {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(teamIdCode)}`
      setQrCodeUrl(qrUrl)
    }
  }, [teamIdCode])

  const handleGeneratePlayerCodes = async () => {
    try {
      const response = await fetch("/api/roster/generate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert("Failed to generate team codes")
      }
    } catch (err) {
      alert("Error generating team codes")
    }
  }

  if (!teamIdCode) {
    return null
  }

  return (
    <Card className="bg-[#1e3a5f] border-[#1e3a5f] mb-6">
      <CardHeader>
        <CardTitle className="text-[#FFFFFF]">Team Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[#FFFFFF]/80 text-sm">
          Share this team code with Assistant Coaches, Players, and Parents so they can join your team.
        </p>
        
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="flex-1">
            <p className="text-sm text-[#FFFFFF]/70 mb-2">Team Code</p>
            <div className="p-4 bg-[#FFFFFF]/10 rounded-lg border border-[#FFFFFF]/20">
              <p className="text-3xl font-bold text-[#FFFFFF] font-mono tracking-wider text-center">{teamIdCode}</p>
            </div>
          </div>
          
          {qrCodeUrl && (
            <div className="flex flex-col items-center">
              <p className="text-sm text-[#FFFFFF]/70 mb-2">QR Code</p>
              <div className="p-4 bg-[#FFFFFF] rounded-lg">
                <img src={qrCodeUrl} alt="Team Code QR Code" className="w-48 h-48" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#FFFFFF]/20">
          <p className="text-sm text-[#FFFFFF]/70 mb-4">
            Each player on your roster will receive a unique team code. Generate codes for all players below.
          </p>
          <Button
            onClick={handleGeneratePlayerCodes}
            className="bg-[#1e3a5f] text-[#FFFFFF] hover:bg-[#2d4a6f]"
          >
            Generate Team Codes
          </Button>
        </div>

        {players.length > 0 && (
          <div className="pt-4 border-t border-[#FFFFFF]/20">
            <p className="text-sm font-semibold text-[#FFFFFF] mb-3">Team Codes</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-[#FFFFFF]/10 rounded border border-[#FFFFFF]/20"
                >
                  <div>
                    <p className="text-[#FFFFFF] font-medium">
                      {player.firstName} {player.lastName}
                      {player.jerseyNumber && ` (#${player.jerseyNumber})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {player.uniqueCode ? (
                      <>
                        <p className="text-lg font-mono font-bold text-[#FFFFFF]">{player.uniqueCode}</p>
                        <div className="w-16 h-16 bg-[#FFFFFF] p-1 rounded">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(player.uniqueCode)}`}
                            alt={`QR Code for ${player.firstName} ${player.lastName}`}
                            className="w-full h-full"
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-[#FFFFFF]/50 text-sm">No code</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
