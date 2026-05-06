"use client"

import { endBraikPerfTimer, startBraikPerfTimer } from "@/lib/perf/braik-perf-client"

const activeTimers = new Map<string, number>()

export function startBraikInteractionTimer(key: string): void {
  activeTimers.set(key, startBraikPerfTimer(key))
}

export function endBraikInteractionTimer(
  key: string,
  event: string,
  extra: Record<string, unknown> = {}
): void {
  const start = activeTimers.get(key)
  if (!start) return
  activeTimers.delete(key)
  endBraikPerfTimer(event, start, extra)
}

export function cancelBraikInteractionTimer(key: string): void {
  activeTimers.delete(key)
}

export function braikThreadOpenTimerKey(threadId: string): string {
  return `messages.thread_open.${threadId}`
}

export function braikMessageSendTimerKey(threadId: string): string {
  return `messages.send.${threadId}`
}
