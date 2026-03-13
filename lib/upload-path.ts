/**
 * Upload root directory for file storage.
 * In serverless (Vercel, Lambda), process.cwd() is read-only (/var/task), so we use /tmp
 * to avoid ENOENT on mkdir. Note: /tmp is ephemeral and not shared across invocations;
 * for production file persistence, use Supabase Storage instead.
 */
export function getUploadRoot(): string {
  if (process.env.VERCEL) return "/tmp"
  return process.cwd()
}
