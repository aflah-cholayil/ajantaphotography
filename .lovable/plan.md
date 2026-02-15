
# AWS S3 to Cloudflare R2 Migration Plan

## Overview
Migrate all media storage from AWS S3 to Cloudflare R2 while keeping AWS operational for existing files. R2 is S3-compatible, so we use the same `aws4fetch` library with different credentials/endpoint.

## Phase 1: Infrastructure Setup

### 1.1 Add `storage_provider` column to `media` and `works` tables
- Add column `storage_provider TEXT NOT NULL DEFAULT 'aws'` to `media` table
- Add column `storage_provider TEXT NOT NULL DEFAULT 'aws'` to `works` table
- All existing records default to `'aws'`
- The `people.face_thumbnail_key` and `albums.cover_image_key` inherit from their album's media provider

### 1.2 Add R2 secrets
New secrets to configure:
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (ajanta-media)
- `R2_ENDPOINT` (https://ACCOUNT_ID.r2.cloudflarestorage.com)

### 1.3 Create shared storage helper
Since 10 edge functions use S3, create a reusable pattern inside each function (edge functions can't share imports across folders). Each function will include a helper that picks the right client:

```text
// Pattern used in each edge function:
const awsClient = new AwsClient({ ...AWS creds, region: awsRegion });
const r2Client = new AwsClient({ ...R2 creds, region: "auto" });

function getStorageClient(provider: "aws" | "r2") {
  return provider === "r2" ? r2Client : awsClient;
}

function getObjectUrl(provider: "aws" | "r2", key: string) {
  if (provider === "r2") {
    return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
  }
  return `https://${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}
```

---

## Phase 2: Update Edge Functions (all 9 affected functions)

### 2.1 Upload functions -- point NEW uploads to R2

**`s3-upload`** (small file presigned URLs):
- Initialize both AWS and R2 clients
- Generate presigned PUT URL against R2 endpoint
- Return `storage_provider: "r2"` in the response

**`s3-multipart-upload`** (large file multipart):
- Accept optional `storageProvider` param (default `"r2"`)
- Use R2 client for initiate, part URLs, complete, abort
- Return `storage_provider: "r2"` in response

**`upload-asset`** (showcase videos, logos):
- Switch to R2 client for new asset uploads

**`manage-work`** (portfolio upload):
- Switch `upload-url` action to use R2 client
- Switch `delete` action to check `storage_provider` and delete from correct backend

### 2.2 Read functions -- support dual-read

**`s3-signed-url`** (main signed URL function):
- Accept optional `storageProvider` param
- When serving media, look up `storage_provider` from DB if not provided
- Generate signed URL from correct backend (AWS or R2)

**`get-share-gallery`** (shared gallery URLs):
- For each media item, check its `storage_provider`
- Generate signed URL from the correct backend

### 2.3 Delete functions -- delete from correct backend

**`storage-cleanup`** (delete media/albums/clients):
- When deleting a media item, read its `storage_provider` from DB
- Call `deleteS3Object` or `deleteR2Object` accordingly

**`manage-work`** (delete action):
- Read `storage_provider` from the `works` record
- Delete from correct backend

### 2.4 Analytics function

**`storage-stats`**:
- List objects from both AWS and R2 buckets
- Combine totals for the dashboard
- Show separate AWS vs R2 breakdown

### 2.5 Face detection

**`face-detection`**:
- AWS Rekognition needs the image in an S3 bucket it can access
- For R2-stored images: generate a signed R2 URL, download the image bytes, and send to Rekognition via `Image.Bytes` instead of `Image.S3Object`
- This is a key compatibility change since Rekognition cannot directly read from R2

---

## Phase 3: Update Frontend Upload Engine

**`src/lib/uploadEngine.ts`**:
- No changes needed for the upload flow itself -- it calls edge functions which handle the provider switch
- Update `saveMediaRecordWithRetry` to pass `storageProvider: "r2"` to `save-media-record`

**`save-media-record` edge function**:
- Accept `storageProvider` field
- Save it to the `media.storage_provider` column

**`src/components/client/AlbumCover.tsx`** and all signed URL calls:
- Pass `storageProvider` when calling `s3-signed-url` (or let the function look it up from DB)

---

## Phase 4: Background Migration Job

Create a new edge function `migrate-to-r2`:
- Accepts `action: "start" | "status" | "cancel"`
- On start: queries all `media` and `works` where `storage_provider = 'aws'`
- For each file:
  1. Generate signed GET URL from AWS
  2. Download file content
  3. Upload to R2 using PUT with presigned URL
  4. Verify R2 object exists (HEAD request)
  5. Update DB record: `storage_provider = 'r2'`
  6. Log progress to a `migration_logs` table or `studio_settings`
- Process in batches (50 files at a time) to avoid timeout
- Track progress so it can be resumed
- Do NOT delete from AWS (manual step after 30-day safety period)

---

## Phase 5: Storage Dashboard Update

Update `src/pages/admin/StorageDashboard.tsx`:
- Show AWS vs R2 storage breakdown
- Add migration progress indicator
- Add "Start Migration" button for owner role
- Show count of files remaining on AWS

---

## Database Changes

### Migration 1: Add storage_provider columns
```sql
ALTER TABLE media ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'aws';
ALTER TABLE works ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'aws';
```

---

## Edge Functions to Create/Modify

| Function | Change |
|---|---|
| `s3-upload` | Add R2 client, switch new uploads to R2 |
| `s3-multipart-upload` | Add R2 client, switch new uploads to R2 |
| `s3-signed-url` | Dual-read: check provider, sign from correct backend |
| `upload-asset` | Switch to R2 for new uploads |
| `save-media-record` | Accept and save `storage_provider` field |
| `storage-cleanup` | Read provider from DB, delete from correct backend |
| `storage-stats` | List from both AWS and R2, combine stats |
| `get-share-gallery` | Check provider per media item, sign correctly |
| `face-detection` | Use `Image.Bytes` for R2-stored images |
| `manage-work` | Switch uploads to R2, dual-read/delete |
| `migrate-to-r2` (NEW) | Background migration job |

## Frontend Changes

| File | Change |
|---|---|
| `src/lib/uploadEngine.ts` | Pass `storageProvider: "r2"` to save-media-record |
| `src/pages/admin/StorageDashboard.tsx` | Show AWS vs R2 breakdown, migration controls |

## Secrets Required

4 new secrets need to be added before implementation:
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`

## Implementation Order

1. Add secrets (user provides R2 credentials)
2. Run database migration (add `storage_provider` columns)
3. Update all edge functions (dual-provider support)
4. Update frontend (minimal changes)
5. Deploy and test new uploads going to R2
6. Create and run migration job for existing files
7. After 30 days: disable AWS, clean up
