export type GameVideoRow = {
  id: string
  title: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
  upload_status?: string | null
  processing_status?: string | null
  created_at?: string | null
}

export type ClipMetadata = {
  categories?: Record<string, string>
  ai?: { source?: string; generatedAt?: string }
}

export type ClipRow = {
  id: string
  start_ms: number
  end_ms: number
  duration_ms?: number | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  share_token?: string | null
  metadata?: ClipMetadata | null
}

export type UploadUiState = {
  phase: "preparing" | "uploading" | "finalizing" | "success"
  pct: number
  fileName: string
}
