"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X } from "lucide-react"

interface PlaybookUploadFormProps {
  teamId: string
  onUploadComplete: () => void
  onCancel: () => void
}

export function PlaybookUploadForm({ teamId, onUploadComplete, onCancel }: PlaybookUploadFormProps) {
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      if (!title.trim()) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""))
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file")
      return
    }

    if (!title.trim()) {
      setError("Please enter a title")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", title)
      formData.append("category", "playbook")
      formData.append("teamId", teamId)

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to upload playbook")
      }

      onUploadComplete()
    } catch (err: any) {
      setError(err.message || "Error uploading playbook")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Playbook Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter playbook title..."
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="file">Playbook File</Label>
        <div className="mt-1 flex items-center gap-2">
          <label
            htmlFor="file-upload"
            className="flex items-center gap-2 px-4 py-2 border-2 rounded cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#0B2A5B" }}
          >
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Click here to attach files"}</span>
          </label>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
          />
          {file && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              className="text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {file && (
          <p className="mt-1 text-sm text-gray-500">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleUpload} disabled={loading || !file || !title.trim()}>
          {loading ? "Uploading..." : "Upload Playbook"}
        </Button>
      </div>
    </div>
  )
}
