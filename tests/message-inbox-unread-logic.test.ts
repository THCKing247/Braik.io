import { countUnreadMessagesFromOthers } from "@/lib/messaging/inbox-unread-logic"

const uid = "11111111-1111-1111-1111-111111111111"
const other = "22222222-2222-2222-2222-222222222222"

function legacyLoop(
  messages: { sender_id: string; created_at: string }[],
  userId: string,
  lastReadAt: string | null
): number {
  let n = 0
  for (const m of messages) {
    if (m.sender_id === userId) continue
    if (!lastReadAt || new Date(m.created_at).getTime() > new Date(lastReadAt).getTime()) {
      n++
    }
  }
  return n
}

const samples: {
  messages: { sender_id: string; created_at: string }[]
  lastReadAt: string | null
}[] = [
  { messages: [], lastReadAt: null },
  {
    messages: [{ sender_id: other, created_at: "2025-01-02T12:00:00.000Z" }],
    lastReadAt: null,
  },
  {
    messages: [
      { sender_id: uid, created_at: "2025-01-01T12:00:00.000Z" },
      { sender_id: other, created_at: "2025-01-03T12:00:00.000Z" },
    ],
    lastReadAt: "2025-01-02T15:00:00.000Z",
  },
  {
    messages: [{ sender_id: other, created_at: "2025-01-01T08:00:00.000Z" }],
    lastReadAt: "2025-01-05T00:00:00.000Z",
  },
]

console.log("--- message inbox unread logic ---")
let ok = true
for (const s of samples) {
  const a = countUnreadMessagesFromOthers(s.messages, uid, s.lastReadAt)
  const b = legacyLoop(s.messages, uid, s.lastReadAt)
  if (a !== b) {
    console.error("mismatch", { a, b, s })
    ok = false
  }
}
if (!ok) process.exit(1)
console.log("ok: helper matches legacy inbox unread loop")
