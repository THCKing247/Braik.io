import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { VIDEO_SIGNED_URL_TTL_SECONDS } from "@/lib/video/constants"

export type R2Env = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /** Optional public base for public buckets — playback uses signed URLs by default */
  publicBaseUrl: string | null
}

export function readR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null
  }
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() || null
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl }
}

let client: S3Client | null = null

export function getR2S3Client(): S3Client | null {
  const env = readR2Env()
  if (!env) return null
  if (client) return client
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${env.accountId}.r2.cloudflarestorage.com`
  const region = process.env.R2_REGION?.trim() || "auto"
  client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })
  return client
}

export function getR2BucketName(): string | null {
  return readR2Env()?.bucket ?? null
}

export async function presignedPutObjectUrl(key: string, contentType: string): Promise<string | null> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return null
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(c, cmd, { expiresIn: VIDEO_SIGNED_URL_TTL_SECONDS })
}

export async function presignedGetObjectUrl(key: string): Promise<string | null> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return null
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(c, cmd, { expiresIn: VIDEO_SIGNED_URL_TTL_SECONDS })
}

export async function headObjectMeta(key: string): Promise<{ contentLength: number | null; contentType: string | null } | null> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return null
  try {
    const out = await c.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return {
      contentLength: typeof out.ContentLength === "number" ? out.ContentLength : null,
      contentType: out.ContentType ?? null,
    }
  } catch {
    return null
  }
}

export async function createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string } | null> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return null
  const out = await c.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  )
  if (!out.UploadId) return null
  return { uploadId: out.UploadId }
}

export async function presignedUploadPartUrl(key: string, uploadId: string, partNumber: number): Promise<string | null> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return null
  if (partNumber < 1 || partNumber > 10000) return null
  const cmd = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return getSignedUrl(c, cmd, { expiresIn: VIDEO_SIGNED_URL_TTL_SECONDS })
}

export async function deleteObjectFromR2(key: string): Promise<boolean> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return false
  try {
    await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<boolean> {
  const c = getR2S3Client()
  const bucket = getR2BucketName()
  if (!c || !bucket) return false
  const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber)
  try {
    await c.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sorted.map((p) => ({
            ETag: p.ETag,
            PartNumber: p.PartNumber,
          })),
        },
      })
    )
    return true
  } catch {
    return false
  }
}
