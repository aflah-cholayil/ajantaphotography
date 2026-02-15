

# Storage Dashboard - Implementation Plan

## Overview
Add a new "Storage Dashboard" page to the admin panel that displays real-time AWS S3 usage analytics, bandwidth estimates, and cost projections. Data is fetched securely via a backend function using existing AWS credentials.

## Architecture

### Backend: New Edge Function `storage-stats`
A single edge function that queries AWS S3 (using `aws4fetch`, already used in other functions) and the local database to compile storage statistics. Admin-only access enforced via JWT validation.

**Data Sources:**
- **S3 ListObjectsV2** - List all objects to calculate total bucket size, group by prefix (album/client)
- **Database queries** - Join `media`, `albums`, `clients`, `profiles` tables to map storage per client
- **Database aggregation** - Calculate monthly uploads from `media.created_at` timestamps
- **Share links** - Use `view_count` and `download_count` from `share_links` for bandwidth estimates

**Why not CloudWatch/Cost Explorer?**
- CloudWatch `GetMetricStatistics` and Cost Explorer APIs require additional IAM permissions (`cloudwatch:GetMetricData`, `ce:GetCostAndUsage`) that may not be configured
- Instead, we calculate estimates from actual S3 object data and database records, which is more reliable and doesn't require extra permissions

**Caching:**
- Results cached in `studio_settings` table with a 10-minute TTL key (`storage_stats_cache` + `storage_stats_cache_time`)
- On each request, check if cache is fresh; if so, return cached data without calling AWS

### Frontend: New Admin Page
A dashboard page at `/admin/storage` with summary cards, charts, and per-client table.

---

## Step-by-Step Implementation

### Step 1: Create the `storage-stats` Edge Function

File: `supabase/functions/storage-stats/index.ts`

- CORS headers (matching existing pattern)
- JWT auth validation (admin-only via `getClaims` + role check)
- S3 ListObjectsV2 pagination to enumerate all objects
- Group objects by prefix to map to albums
- Query `media` + `albums` + `clients` + `profiles` to build per-client breakdown
- Calculate:
  - Total storage (sum of all object sizes)
  - This month's uploads (filter `media` by `created_at` in current month)
  - Per-client storage usage
  - Estimated downloads from `share_links.download_count` and average file sizes
  - Cost projections using provided INR rates (1.9/GB storage, 7/GB transfer after 100GB free)
- Cache results in `studio_settings` for 10 minutes
- Return JSON response

### Step 2: Add Route Config

Update `supabase/config.toml` to add:
```toml
[functions.storage-stats]
verify_jwt = false
```

### Step 3: Create the Dashboard Page

File: `src/pages/admin/StorageDashboard.tsx`

**Summary Cards (top row):**
- Total Storage Used (GB) with HardDrive icon
- This Month Uploads (GB) with Upload icon
- Estimated Downloads (GB) with Download icon
- Estimated Monthly Cost (INR) with IndianRupee icon

**Charts (middle section):**
- Storage growth line chart (last 6 months) using Recharts
- Cost breakdown pie chart (Storage vs Transfer vs Requests)

**Per-Client Table (bottom section):**
- Client Name, Albums, Storage Used, Downloads, Estimated Cost
- Sortable columns

**Warning Alerts:**
- Banner if storage exceeds 80% of a configurable threshold
- Banner if monthly cost exceeds 5000 INR

### Step 4: Add Navigation and Route

- Update `AdminLayout.tsx` nav items to include Storage Dashboard with `HardDrive` icon
- Update `App.tsx` to add route `/admin/storage` pointing to `StorageDashboard`

---

## Technical Details

### Cost Calculation Formula
```
Storage Cost = totalGB * 1.9 INR
Transfer Cost = max(0, downloadGB - 100) * 7 INR
Total = Storage Cost + Transfer Cost
```

### Caching Strategy
- Store serialized JSON in `studio_settings` with key `storage_stats_cache`
- Store timestamp in `storage_stats_cache_time`
- Edge function checks: if `now - cache_time < 10 minutes`, return cached data
- Frontend shows "Last updated X minutes ago" indicator
- Manual refresh button bypasses cache (passes `force=true` param)

### Security
- Edge function validates JWT and checks user role is owner/admin via database query
- Only users with `owner` or `admin` role can access
- AWS credentials never exposed to frontend
- All data flows through the edge function

### Files to Create/Modify
1. **Create** `supabase/functions/storage-stats/index.ts` - Backend edge function
2. **Create** `src/pages/admin/StorageDashboard.tsx` - Dashboard UI page
3. **Modify** `supabase/config.toml` - Add function config
4. **Modify** `src/components/admin/AdminLayout.tsx` - Add nav item
5. **Modify** `src/App.tsx` - Add route

