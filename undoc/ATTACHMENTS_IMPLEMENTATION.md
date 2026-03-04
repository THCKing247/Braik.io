# Message Attachments & Storage Implementation

## Overview

This document describes the secure attachment handling system for Braik messaging, implementing file uploads, metadata tracking, and access control aligned with role-based visibility rules.

## Key Features

### 1. **MessageAttachment Model**
- New database model for tracking attachment metadata
- Links attachments to messages, threads, and teams
- Stores file metadata: fileName, fileUrl (secure path), fileSize, mimeType
- Denormalized threadId and teamId for efficient access checks

### 2. **Secure File Storage**
- Files stored with secure naming: `{timestamp}-{random}-{sanitized-name}`
- Files stored in `./uploads/messages/` directory
- File paths are not public URLs - served through secure endpoints

### 3. **Access Control**
- **Direct Participants**: Users who are participants in a thread can access all attachments
- **Parents (HS Only)**: Can view attachments in threads involving their child
  - Only applies to high school teams (organization.type === "school")
  - Uses parent-child relationship via GuardianPlayer links
- **Platform Owner**: Can access all attachments (for disputes)
- **Others**: No access unless direct participant

### 4. **File Type & Size Validation**
- **Allowed Types**:
  - PDFs: `application/pdf`
  - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - Documents: Word, Excel, text files, CSV
  - Short Videos: `video/mp4`, `video/quicktime`, `video/x-msvideo` (max 50MB, non-film)
- **Size Limits**:
  - General: 100MB max
  - Videos: 50MB max (short clips only, not film)
  - Images: 10MB max
  - Documents: 25MB max

### 5. **Secure Endpoints**

#### Upload Endpoint
- `POST /api/messages/attachments`
- Validates file type, size, and user team membership
- Returns secure fileUrl (not public URL)

#### Serve by Attachment ID
- `GET /api/messages/attachments/[attachmentId]`
- Primary secure endpoint for serving attachments
- Enforces access control based on thread participation and role

#### Serve by File URL (Backward Compatibility)
- `GET /api/messages/attachments/serve?fileUrl=...`
- Provides backward compatibility for old attachments
- Enforces same access control rules

## Implementation Details

### Database Schema

```prisma
model MessageAttachment {
  id        String   @id @default(cuid())
  messageId String
  threadId  String   // Denormalized for efficient access checks
  teamId    String   // Denormalized for efficient access checks
  fileName  String
  fileUrl   String   // Secure path, not public URL
  fileSize  Int
  mimeType  String
  uploadedBy String
  createdAt DateTime @default(now())

  message Message @relation(...)
  thread  MessageThread @relation(...)
  team    Team @relation(...)
  uploader User @relation(...)
}
```

### Access Control Logic

1. **Check Direct Participation**: User is a participant in the thread
2. **Check Parent Visibility (HS Only)**:
   - Verify team is high school (organization.type === "school")
   - Get parent's accessible player IDs
   - Check if any child is a participant in the thread
3. **Check Platform Owner**: Platform Owner can access all
4. **Default**: Deny access

### Frontend Integration

The frontend has been updated to:
- Use secure endpoints for file access
- Support both attachment ID and fileUrl (for backward compatibility)
- Display attachments with proper access control

```typescript
// Frontend uses secure endpoint
const secureUrl = att.id 
  ? `/api/messages/attachments/${att.id}`
  : `/api/messages/attachments/serve?fileUrl=${encodeURIComponent(att.fileUrl)}`
```

## Security Considerations

1. **No Public URLs**: Files are never served via public URLs
2. **Access Control**: Every file access is checked against thread participation and role
3. **Parent Visibility**: Only applies to high school teams, not university
4. **File Validation**: Type and size validation on upload
5. **Secure Naming**: Files stored with timestamp + random component to prevent guessing

## Migration Notes

- Existing messages with attachments in JSON format continue to work
- New messages create MessageAttachment records
- Frontend supports both old (fileUrl) and new (attachment ID) formats
- Old `/api/uploads/[...path]` endpoint remains for non-message files but should not be used for message attachments

## Future Enhancements

- Virus/malware scanning hooks (when available)
- S3 integration for production storage
- Attachment preview/thumbnail generation
- Attachment deletion with proper cleanup

## Compliance with BRAIK_MASTER_INTENT.md

✅ **Attachments Allowed**: PDFs, images, documents, short video clips (non-film)
✅ **Access Rules**: Only authorized roles can view/download
✅ **Parent Visibility**: Parents can view attachments in threads involving their child (HS only)
✅ **Safe Storage**: Metadata in DB, secure URLs, permission checks
✅ **Size/Type Validation**: Implemented with appropriate limits
✅ **No Film Libraries**: Short videos only, explicitly not film hosting
✅ **No Public Links**: All access requires authentication and authorization
