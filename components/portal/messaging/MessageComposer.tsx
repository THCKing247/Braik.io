"use client"

import { Paperclip, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

export function MessageComposer({
  disabled,
  loading,
  messageBody,
  attachments,
  onMessageBodyChange,
  onFileUpload,
  onRemoveAttachment,
  onSend,
}: {
  disabled?: boolean
  loading: boolean
  messageBody: string
  attachments: any[]
  onMessageBodyChange: (value: string) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (index: number) => void
  onSend: () => void
}) {
  if (disabled) return null

  return (
    <div className="flex-shrink-0 border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]" style={{ borderTopColor: "rgb(var(--border))" }}>
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={att?.id ?? `${att?.fileName ?? "file"}-${idx}`}
              className="flex items-center gap-1 rounded border-2 px-2 py-1 text-xs"
              style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "#0B2A5B" }}
            >
              <span>{att.fileName}</span>
              <button onClick={() => onRemoveAttachment(idx)} className="text-red-500 hover:text-red-700">
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="cursor-pointer rounded p-2 hover:bg-opacity-50" style={{ backgroundColor: "rgb(var(--platinum))" }}>
          <Paperclip className="h-4 w-4" style={{ color: "rgb(var(--text))" }} />
          <input
            type="file"
            onChange={onFileUpload}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.mp4,.mov,.avi"
          />
        </label>
        <textarea
          value={messageBody}
          onChange={(e) => onMessageBodyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Type a message..."
          className="mobile-textarea max-h-40 min-h-[44px] flex-1 resize-none"
        />
        <Button onClick={onSend} disabled={loading || !messageBody.trim()} className="h-11 min-w-[44px] rounded-xl">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
