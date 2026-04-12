/** Safe filename segment for roster email attachments (PDF / HTML). */
export function rosterAttachmentBaseName(teamName: string): string {
  const safe = teamName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80)
  return (safe || "Team") + "-Roster"
}
