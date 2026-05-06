"use client"

import { useCallback } from "react"
import { navPerfDev } from "@/lib/debug/nav-perf-dev"
import type { Contact, Message, Thread } from "@/components/portal/messaging/types"

export function useOptimisticMessageSend({
  selectedThread,
  userId,
  contacts,
  attachments,
  messageBody,
  setMessages,
  setMessageBody,
  setAttachments,
  setError,
  setLoading,
  optimisticMessageIdRef,
  setIngressOptimistic,
  setIngressUserSend,
  forceScrollIntentBottom,
  onAfterSuccessfulSend,
}: {
  selectedThread: Thread | null
  userId: string
  contacts: Contact[]
  attachments: any[]
  messageBody: string
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setMessageBody: React.Dispatch<React.SetStateAction<string>>
  setAttachments: React.Dispatch<React.SetStateAction<any[]>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  optimisticMessageIdRef: React.MutableRefObject<string | null>
  setIngressOptimistic: () => void
  setIngressUserSend: () => void
  forceScrollIntentBottom: () => void
  onAfterSuccessfulSend: () => void
}) {
  const sendMessage = useCallback(async () => {
    if (!selectedThread || !messageBody.trim()) return
    if (selectedThread.isReadOnly) {
      alert("You have read-only access to this thread")
      return
    }

    const messageText = messageBody.trim()
    const messageAttachments = attachments.length > 0 ? attachments : []
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const currentUserContact = contacts.find((c) => c.id === userId)

    const optimisticMessage: Message = {
      id: tempId,
      body: messageText,
      attachments: messageAttachments,
      createdAt: new Date(),
      creator: {
        id: userId,
        name: currentUserContact?.name || null,
        email: currentUserContact?.email || "",
      },
    }

    navPerfDev("messages.send.optimistic_render", { threadId: selectedThread.id })
    forceScrollIntentBottom()
    setIngressOptimistic()
    setMessages((prev) => [...prev, optimisticMessage])
    setMessageBody("")
    setAttachments([])
    setError(null)

    setLoading(true)
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThread.id,
          body: messageText,
          attachments: messageAttachments,
        }),
      })
      const responseData = await response.json()
      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        const errorMessage = responseData.error || responseData.details || "Failed to send message"
        throw new Error(errorMessage)
      }

      const newMessage = responseData as Message
      optimisticMessageIdRef.current = newMessage.id
      forceScrollIntentBottom()
      setIngressUserSend()
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId)
        const exists = filtered.some((m) => m.id === newMessage.id)
        if (exists) return filtered.map((m) => (m.id === newMessage.id ? newMessage : m))
        return [...filtered, newMessage].sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime()
          const bTime = new Date(b.createdAt).getTime()
          return aTime - bTime
        })
      })
      navPerfDev("messages.send.server_confirmed", { threadId: selectedThread.id })
      onAfterSuccessfulSend()
    } catch (error: any) {
      const errorMessage = error.message || "Error sending message"
      setError(errorMessage)
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [
    selectedThread,
    messageBody,
    attachments,
    contacts,
    userId,
    forceScrollIntentBottom,
    setIngressOptimistic,
    setMessages,
    setMessageBody,
    setAttachments,
    setError,
    setLoading,
    optimisticMessageIdRef,
    setIngressUserSend,
    onAfterSuccessfulSend,
  ])

  return { sendMessage }
}
