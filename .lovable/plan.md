

# Storage Dashboard UI — Full Rebuild

## Summary
Rebuild `src/pages/admin/StorageDashboard.tsx` to show dual-provider analytics, migration controls, and cost comparison. Uses existing edge function data (no backend changes needed).

## What Changes

### Single file: `src/pages/admin/StorageDashboard.tsx`

**1. Update the `StorageStats` interface** to include the `providerBreakdown` field already returned by the `storage-stats` edge function:
```text
providerBreakdown: {
  aws: { totalBytes, totalGB, totalObjects, costINR };
  r2:  { totalBytes, totalGB, totalObjects, costINR };
};
```

**2. Add migration state and API calls:**
- New state: `migrationStatus` (idle / running / done), `migrationResult` (last batch result), `migrationCounts` (from `migrate-to-r2?action=status`)
- `fetchMigrationStatus()` — calls `migrate-to-r2` with `action: "status"`, returns `{ media: {aws, r2}, works: {aws, r2}, totalRemaining }`
- `startMigrationBatch()` — calls `migrate-to-r2` with `action: "start"`, returns `{ migrated, failed, errors, message }`
- Auto-polls migration status every 5 seconds while running

**3. New UI sections (top to bottom):**

**Section A — Provider Breakdown Cards (replaces current 4-card grid)**
- 6 cards in 2 rows:
  - Row 1: Total Storage (combined), AWS Storage (GB + file count), R2 Storage (GB + file count)
  - Row 2: This Month Uploads, Est. Monthly Cost, Cost Savings (R2 vs AWS comparison)
- AWS cards have orange/amber accent, R2 cards have blue accent

**Section B — Migration Control Panel**
- Card with title "Storage Migration — AWS to R2"
- Progress bar showing `(r2Files / totalFiles) * 100`
- Text: "X of Y files migrated (Z remaining on AWS)"
- Status badges: media counts (AWS/R2), works counts (AWS/R2)
- "Start Migration" button (with confirmation dialog)
  - Safety warning: "This will copy files from AWS to R2 in batches of 20. Existing files will not be deleted. Continue?"
  - Shows spinner while running
- After each batch: shows result (migrated/failed counts)
- "Run Next Batch" button to continue
- Error list (if any failures)

**Section C — Cost Comparison Table**
- Side-by-side table: AWS vs R2
  - Storage cost per GB (AWS: ~₹1.9/GB, R2: ₹1.2/GB after 10GB free)
  - Transfer cost (AWS: ₹7/GB after 100GB, R2: Free)
  - Current monthly cost per provider
  - Projected cost if fully on R2
  - Monthly savings

**Section D — Charts (keep existing)**
- Storage Growth bar chart (unchanged)
- Cost Breakdown pie chart — update to show AWS vs R2 storage cost split instead of storage vs transfer

**Section E — Per-Client Table (keep existing, unchanged)**

**4. Confirmation Dialog for Migration**
- Uses existing `AlertDialog` component
- Title: "Start Storage Migration"
- Warning text explaining the process
- "Cancel" and "Start Migration" buttons

## Technical Details

- All data comes from two existing edge functions: `storage-stats` and `migrate-to-r2`
- No new edge functions or DB changes needed
- Migration runs one batch at a time (user clicks to continue) — prevents runaway costs
- Uses `useQuery` for storage stats, `useState` + manual fetch for migration (since it's a mutation)
- Progress percentage: `totalR2Files / (totalAWSFiles + totalR2Files) * 100`
- Icons: `Cloud` for R2, `Server` for AWS, `ArrowRightLeft` for migration
- Dark theme: matches existing card/chart styling with `hsl(30, 10%, 12%)` backgrounds

## Files to Modify
1. `src/pages/admin/StorageDashboard.tsx` — full rewrite of this single page
