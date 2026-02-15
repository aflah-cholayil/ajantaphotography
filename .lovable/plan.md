

# Fix Storage Dashboard Refresh

## Problem

The `handleRefresh` function on line 105-108 has a race condition:

1. Sets `forceRefresh = true` (queryKey becomes `['storage-stats', true]`)
2. After 100ms, calls `refetch()` and sets `forceRefresh = false`
3. Setting `forceRefresh = false` changes the queryKey back to `['storage-stats', false]`, which still has stale cached data
4. The fresh data fetched with `force=true` is stored under a different queryKey and never displayed

## Fix

Replace the current approach with a simpler pattern:

- Remove `forceRefresh` from the queryKey entirely
- Use a ref or direct parameter to control the `force` flag
- Call `refetch()` after invalidating the cache

### Technical Details

**File: `src/pages/admin/StorageDashboard.tsx`**

Replace the current state + query setup (lines 96-108):

```typescript
// Remove forceRefresh state entirely

const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
  queryKey: ['storage-stats'],
  queryFn: () => fetchStorageStats(false),
  staleTime: 10 * 60 * 1000,
  retry: 1,
});

const handleRefresh = useCallback(async () => {
  // Fetch fresh data with force=true directly
  const queryClient = useQueryClient();
  await queryClient.fetchQuery({
    queryKey: ['storage-stats'],
    queryFn: () => fetchStorageStats(true),
  });
}, []);
```

This ensures:
- Fresh data is fetched with `force=true` (bypasses the 10-min server cache)
- The result is stored under the same queryKey, so the UI updates immediately
- No race condition between state changes and refetches

One additional import (`useQueryClient` from `@tanstack/react-query`) will be added.

