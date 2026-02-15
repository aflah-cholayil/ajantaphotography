

# Complete AWS S3 Removal — R2 Only

## Summary
Remove all AWS S3 client initialization, dual-provider branching, and AWS environment variable usage from every edge function. Keep the `storage_provider` column in the database (it's harmless and avoids a migration) but default everything to `'r2'`. The `s3-signed-url` function needs special handling since existing DB records may still say `'aws'` — we'll update those records and then simplify the function.

## Pre-requisite: Update existing DB records

Before deploying the new code, update all existing `storage_provider = 'aws'` records to `'r2'` since all files now live in R2:

```sql
UPDATE media SET storage_provider = 'r2' WHERE storage_provider = 'aws';
UPDATE works SET storage_provider = 'r2' WHERE storage_provider = 'aws';
```

This is a data update (not schema change), so it will be done via the insert/update tool.

## Files to Modify (7 edge functions)

### 1. `supabase/functions/s3-signed-url/index.ts`
**Current**: Initializes both `awsClient` and `r2Client`, has `resolveProvider()` that checks DB and defaults to `'aws'`, and `getSignedUrl()` branches on provider.

**Changes**:
- Remove lines 11-19 (AWS client init)
- Simplify `getSignedUrl()` to only use R2 (remove the provider parameter and AWS branch)
- Remove `resolveProvider()` entirely — always use R2
- Remove `storageProvider` resolution logic; just use R2 directly
- Keep all access control logic (auth, share tokens, etc.) unchanged

### 2. `supabase/functions/storage-cleanup/index.ts`
**Current**: Initializes both `awsClient` and `r2Client` (lines 10-28), has `getStorageClient(provider)` and `getBaseUrl(provider)` helpers, and `deleteStorageObject()` branches on provider. Also deletes cover images and face thumbnails from "both providers."

**Changes**:
- Remove lines 10-18 (AWS client init)
- Remove `getStorageClient()` and `getBaseUrl()` helpers — not needed
- Simplify `deleteStorageObject()` to only use R2 (remove provider parameter)
- Remove `provider` variable usage everywhere in `deleteMediaFromStorage`, `deleteAlbumFromStorage`, `bulkDeleteMedia`
- Remove the "try both providers" pattern for cover images and face thumbnails (lines 200-216) — just use R2

### 3. `supabase/functions/manage-work/index.ts`
**Current**: Initializes both clients (lines 10-28), has `getStorageClient(provider)` and `getBaseUrl(provider)`, delete action looks up `storage_provider` from DB, signed-url action looks up provider from DB.

**Changes**:
- Remove lines 10-18 (AWS client init)
- Remove `getStorageClient()` and `getBaseUrl()` helpers
- Simplify delete action: just use R2 client directly, no provider lookup
- Simplify signed-url action: just use R2 client directly
- In create action: hardcode `storage_provider: 'r2'` (already mostly does this)

### 4. `supabase/functions/face-detection/index.ts`
**Current**: Initializes both `aws` and `r2Client` (lines 10-27). `detectFacesInImage()` downloads from R2 for `provider === "r2"`, uses S3Object reference for AWS. Uses AWS Rekognition (which requires AWS credentials for the Rekognition service itself).

**Changes**:
- Remove AWS S3 client init (lines 10-17: `awsRegion`, `awsBucket`, `aws` client for S3)
- **Keep** a separate AWS client for Rekognition only (needs AWS_ACCESS_KEY_ID and AWS_REGION for the Rekognition API) — this is not S3 storage, it's a separate AWS service
- Simplify `detectFacesInImage()`: always download from R2 (remove the S3Object branch), always send bytes to Rekognition
- Remove `provider` parameter from `detectFacesInImage()` signature
- Remove `storage_provider` usage in `processAlbumFaces()`

### 5. `supabase/functions/storage-stats/index.ts`
**Current**: Lists both AWS and R2 buckets, merges stats, calculates costs for both.

**Changes**:
- Remove AWS client init (lines 151-158)
- Remove AWS bucket listing (line 172)
- Only list R2 bucket
- Remove `providerBreakdown.aws` from response (set to zeros for backward compatibility with the StorageDashboard UI, or remove — the dashboard will be updated)
- Simplify cost calculations to R2 only

### 6. `supabase/functions/migrate-to-r2/index.ts`
**Current**: Contains the full AWS-to-R2 migration logic.

**Changes**: This function is no longer needed since migration is complete. However, to avoid breaking the StorageDashboard UI that calls it, we'll simplify it to just return "migration complete" status:
- Remove AWS client init
- For `action: "status"`: return all zeros for AWS counts (everything is R2 now)
- For `action: "start"`: return "No files remaining to migrate"

### 7. `supabase/functions/save-media-record/index.ts`
**Current**: Already hardcodes `storage_provider: "r2"`. No changes needed.

### 8. `supabase/functions/s3-upload/index.ts`
**Current**: Already R2-only. No changes needed.

### 9. `supabase/functions/s3-multipart-upload/index.ts`
**Current**: Already R2-only. No changes needed.

### 10. `supabase/functions/upload-asset/index.ts`
**Current**: Already R2-only. No changes needed.

## Frontend Changes

### `src/pages/admin/StorageDashboard.tsx`
- The dashboard references `providerBreakdown.aws` — update to handle the simplified response where AWS stats are zero or absent
- The migration panel can show "Migration Complete" permanently

## No Schema Changes
The `storage_provider` column stays in both `media` and `works` tables. It will just always be `'r2'`. Removing it would require a migration and code changes to types — not worth the risk.

## AWS Secrets
After deployment and verification, the following secrets can optionally be removed from the backend configuration:
- `AWS_ACCESS_KEY_ID` — **KEEP** (still needed for AWS Rekognition in face-detection)
- `AWS_SECRET_ACCESS_KEY` — **KEEP** (still needed for AWS Rekognition)
- `AWS_BUCKET_NAME` — can be removed after deployment
- `AWS_REGION` — **KEEP** (still needed for Rekognition endpoint)

## Deployment Order
1. Run the data update (media + works tables set to r2)
2. Deploy all 7 modified edge functions
3. Update StorageDashboard UI
4. Test uploads, signed URLs, and deletions

## Technical Notes
- The `storage_provider` column default in DB is `'aws'` — this should be changed to `'r2'` via migration for any future inserts that don't explicitly set it
- Face detection still needs AWS credentials for the Rekognition API (not S3), so AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION must remain as secrets

