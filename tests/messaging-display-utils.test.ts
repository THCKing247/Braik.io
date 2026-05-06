import {
  messageAttachmentIsImage,
  messageDayKey,
  messageDaySeparatorLabel,
  threadInboxRowKey,
} from "../components/portal/messaging/messaging-display-utils"
import type { Thread } from "../components/portal/messaging/types"

const sampleThread: Thread = {
  id: "thread-1",
  subject: "General",
  threadType: "GROUP",
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-02T12:00:00.000Z"),
  creator: { id: "u-1", name: "Coach", email: "coach@example.com" },
  participants: [],
  messages: [
    {
      id: "m-1",
      body: "hello",
      attachments: [],
      createdAt: new Date("2026-01-02T12:00:00.000Z"),
      creator: { id: "u-1", name: "Coach", email: "coach@example.com" },
    },
  ],
  unreadCount: 2,
  _count: { messages: 1 },
}

let failed = 0
function expectTrue(name: string, value: boolean) {
  if (!value) {
    failed++
    console.error(`FAIL: ${name}`)
  } else {
    console.log(`ok: ${name}`)
  }
}

expectTrue("messageDayKey stable", messageDayKey("2026-02-03T10:11:12.000Z") === "2026-2-3")
expectTrue(
  "messageDaySeparatorLabel includes month/day",
  /[A-Za-z]{3}\s\d{1,2}/.test(messageDaySeparatorLabel("2026-02-03T10:11:12.000Z"))
)
expectTrue("messageAttachmentIsImage by mime", messageAttachmentIsImage({ mimeType: "image/png" }))
expectTrue("messageAttachmentIsImage by extension", messageAttachmentIsImage({ fileName: "photo.jpeg" }))
expectTrue("messageAttachmentIsImage non-image", !messageAttachmentIsImage({ fileName: "notes.pdf" }))
expectTrue("threadInboxRowKey includes unread", threadInboxRowKey(sampleThread).includes(":2"))

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log("\nAll messaging-display-utils tests passed.")
