

# Albums Page Restructure — Group by Client

## Overview
Replace the flat table layout with a card-based layout grouped by client. Each client gets one collapsible card showing their albums inside.

## Data Flow

Current: Fetch albums -> render flat table rows
New: Fetch albums -> group by `client_id` -> render one card per client with collapsible album list

No database or schema changes needed. Same query, just client-side grouping.

## UI Structure

```text
+----------------------------------------------+
| Albums                        [Upload Folder] |
|                               [+ Create Album]|
| [Search...] [Status Filter] [Clear]           |
+----------------------------------------------+
|                                                |
| +------------------------------------------+  |
| | Neymar Jr                                |  |
| | Club Shoot  |  Jan 17, 2026              |  |
| | 2 Albums  |  12 Media  |  Ready          |  |
| |                                          |  |
| | v Albums                                 |  |
| | +--------------------------------------+ |  |
| | | Album 1    3 items   Jan 10   Ready  | |  |
| | |                              [...] | |  |
| | +--------------------------------------+ |  |
| | | Album 2    9 items   Jan 12  Pending | |  |
| | |                              [...] | |  |
| | +--------------------------------------+ |  |
| |                                          |  |
| |            [+ Create Album]              |  |
| +------------------------------------------+  |
|                                                |
| +------------------------------------------+  |
| | Another Client                           |  |
| | Wedding  |  Mar 5, 2026                  |  |
| | 1 Album  |  45 Media  |  Pending         |  |
| | ...                                      |  |
| +------------------------------------------+  |
+------------------------------------------------+
```

## Implementation Details

### Single file to modify: `src/pages/admin/Albums.tsx`

### 1. Grouping Logic
After fetching albums (existing `fetchAlbums` function, no changes needed), group them client-side:

```text
interface ClientGroup {
  clientId: string;
  clientName: string;
  eventName: string;
  eventDate: string | null;
  albums: Album[];
  totalMedia: number;
  overallStatus: 'ready' | 'pending';  // ready if all albums ready
}

// Group filtered albums by client_id
const grouped = filteredAlbums.reduce((map, album) => {
  const key = album.client_id;
  if (!map[key]) map[key] = { ...clientInfo, albums: [] };
  map[key].albums.push(album);
  return map;
}, {});
```

### 2. Fetch Enhancement
Add `event_date` to the albums query's client select:
```text
clients (id, event_name, event_date, user_id)
```
This is a minor change to the existing select statement (line ~160).

### 3. Card Layout (replaces the Table)
Each client group renders as a `Card` component containing:
- **Header row**: Client name (bold), event name, event date (formatted)
- **Stats row**: Album count badge, total media count badge, overall status badge
- **Collapsible section** (using `Collapsible` from radix): Lists each album as a row with:
  - Album title (clickable, navigates to `/admin/albums/:id`)
  - Media count
  - Created date
  - Status badge
  - 3-dot `DropdownMenu` with existing actions (View, Upload, Share, Mark Ready/Pending, Delete)
- **Footer**: "+ Create Album" button that pre-selects this client in the create dialog

### 4. Create Album from Client Card
When clicking "+ Create Album" inside a client card:
- Open the existing create dialog
- Pre-fill `newAlbumClientId` with that client's ID
- User only needs to enter the album title

### 5. Components Used (all already available)
- `Card`, `CardHeader`, `CardContent` for the client card
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` for expandable album list
- `Badge` for album count and media count
- `AlbumStatusBadge` for status
- `DropdownMenu` for the 3-dot menu (reuse existing menu items)
- `Button` for create album
- `ChevronDown` icon for collapse indicator

### 6. Preserved Functionality
- Search filter works the same (filters albums, then groups)
- Status filter works the same
- Client filter from URL params still works
- Delete album updates counts (re-fetches albums)
- Folder upload dialog unchanged
- Upload progress panel unchanged
- All navigation to album detail pages unchanged

### 7. Styling
- Cards use existing dark theme classes (`bg-card border-border`)
- Amber/muted color accents for badges
- Hover states on album rows within the collapsible
- Smooth expand/collapse animation from Collapsible component
- Responsive: cards stack vertically, album rows adapt on mobile

## Technical Notes

- No new components needed; everything uses existing UI primitives
- No new imports beyond adding `Collapsible` components and `ChevronDown` icon
- The `Album` interface needs `event_date` added to the `clients` sub-type
- Performance: grouping is O(n) on already-fetched data, no extra queries
- All existing handlers (delete, status update, create, folder upload) remain unchanged

