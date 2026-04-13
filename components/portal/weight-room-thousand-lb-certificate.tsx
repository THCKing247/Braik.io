"use client"

import { useCallback, useState } from "react"
import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type ThousandLbCertificateData = {
  playerName: string
  jerseyNumber: number | null
  position: string | null
  benchLbs: number
  squatLbs: number
  cleanLbs: number
  combinedThree: number
  dateAchieved: string
  teamName: string
  headCoachName: string
}

function CertificateInner({ data }: { data: ThousandLbCertificateData }) {
  const pos = data.position?.trim() || "—"
  const j = data.jerseyNumber != null ? `#${data.jerseyNumber}` : "#—"

  return (
    <div
      className="certificate-print-target mx-auto box-border max-w-[900px] bg-white p-8 font-serif text-[#0B2A5B]"
      style={{
        border: "4px solid #0B2A5B",
        boxShadow: "inset 0 0 0 3px #F59E0B",
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 12px,
          rgba(245, 158, 11, 0.05) 12px,
          rgba(245, 158, 11, 0.05) 13px
        )`,
      }}
    >
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- printable certificate; html2canvas needs plain img */}
        <img src="/braik-logo.webp" alt="Braik" className="mb-3 h-14 w-auto max-w-[200px] object-contain" />
        <h2 className="text-3xl font-bold uppercase tracking-wide text-[#0B2A5B] md:text-4xl">1000 LB CLUB</h2>
        <Trophy className="mt-2 h-14 w-14 text-[#F59E0B]" strokeWidth={1.5} aria-hidden />
        <p className="mt-2 text-sm font-medium uppercase tracking-widest text-[#0B2A5B]">Certificate of Achievement</p>
      </div>

      <div className="mt-8 space-y-4 text-center">
        <p className="text-lg italic text-[#0B2A5B]">This certifies that</p>
        <p className="text-3xl font-bold text-[#0B2A5B] md:text-4xl">{data.playerName}</p>
        <p className="text-lg text-[#0B2A5B]">
          {j} · {pos}
        </p>
        <p className="text-base text-[#0B2A5B]">has achieved membership in the</p>
        <div className="inline-block rounded-full border-2 border-[#F59E0B] bg-amber-50 px-6 py-2 text-lg font-bold uppercase text-[#0B2A5B]">
          1000 LB CLUB
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[#E5E7EB] bg-white/80 p-3 text-center">
          <p className="text-xs font-semibold uppercase text-[#64748B]">Bench</p>
          <p className="text-xl font-bold tabular-nums text-[#0B2A5B]">{data.benchLbs} lbs</p>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white/80 p-3 text-center">
          <p className="text-xs font-semibold uppercase text-[#64748B]">Squat</p>
          <p className="text-xl font-bold tabular-nums text-[#0B2A5B]">{data.squatLbs} lbs</p>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white/80 p-3 text-center">
          <p className="text-xs font-semibold uppercase text-[#64748B]">Clean</p>
          <p className="text-xl font-bold tabular-nums text-[#0B2A5B]">{data.cleanLbs} lbs</p>
        </div>
        <div className="rounded-lg border border-[#F59E0B] bg-amber-50/90 p-3 text-center">
          <p className="text-xs font-semibold uppercase text-[#F59E0B]">Combined</p>
          <p className="text-xl font-bold tabular-nums text-[#F59E0B]">{data.combinedThree} lbs</p>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-[#64748B]">
        Date achieved: <span className="font-semibold text-[#0B2A5B]">{data.dateAchieved}</span>
      </p>

      <div className="mt-10 border-t border-[#E5E7EB] pt-6 text-center">
        <p className="text-lg font-semibold text-[#0B2A5B]">{data.teamName || "Team"}</p>
        <p className="mt-4 text-sm text-[#0B2A5B]">
          Head Coach: {data.headCoachName?.trim() ? data.headCoachName : "—"}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[#F59E0B]">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden />
          <div className="h-px flex-1 max-w-xs bg-[#F59E0B]/60" />
          <Trophy className="h-4 w-4 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  )
}

export function ThousandLbCertificateDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ThousandLbCertificateData | null
}) {
  const [pdfBusy, setPdfBusy] = useState(false)

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handlePdf = useCallback(async () => {
    if (!data) return
    setPdfBusy(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const { default: jsPDF } = await import("jspdf")
      const element = document.querySelector(".certificate-print-target") as HTMLElement | null
      if (!element) return
      const canvas = await html2canvas(element, { scale: 2, useCORS: true })
      const w = canvas.width / 2
      const h = canvas.height / 2
      const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "px", format: [w, h] })
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h)
      const safe = data.playerName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "player"
      pdf.save(`${safe}-1000lb-club.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }, [data])

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A]">1000 lb Club certificate</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <CertificateInner data={data} />
        </div>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint}>
            Print Certificate
          </Button>
          <Button type="button" onClick={handlePdf} disabled={pdfBusy}>
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
