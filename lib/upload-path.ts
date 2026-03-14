/**
 * Upload root directory for file storage.
 * In serverless (Vercel, Netlify, Lambda), process.cwd() is read-only (/var/task), so we use /tmp
 * to avoid ENOENT on mkdir. Note: /tmp is ephemeral and not shared across invocations;
 * for production file persistence, use Supabase Storage instead.
 */
export function getUploadRoot(): string {
  if (process.env.VERCEL || process.env.NETLIFY) return "/tmp"
  // Lambda-style runtimes (e.g. Netlify Functions) use /var/task as cwd
  if (process.cwd() === "/var/task") return "/tmp"
  return process.cwd()
}
