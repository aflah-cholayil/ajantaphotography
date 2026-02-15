

# Make Uploads Persistent Across Navigation

## Problem

The `UploadEngine` instance and its UI state live inside `MediaUploader` component (via `useRef` and `useState`), which is rendered inside `AlbumDetail`. When navigating away, React unmounts the component, the state is lost, and there's no way to see or control ongoing uploads.

## Architecture

Create a global singleton `UploadManager` + React Context that lives at the App level, completely decoupled from any page component.

```text
App.tsx
  +-- UploadManagerProvider (context + singleton)
  |     +-- GlobalUploadBar (floating UI, visible on all admin pages)
  +-- Routes
        +-- AlbumDetail
              +-- MediaUploader (triggers uploads via context, no longer owns engine)
```

## Changes

### 1. New file: `src/lib/uploadManager.ts` -- Global Singleton

A singleton class that owns all `UploadEngine` instances:

- `activeUploads: Map<string, UploadEngine>` keyed by albumId
- `state: Map<string, UploadEngineState>` -- current state per album
- `listeners: Set<callback>` -- notify React of state changes
- `startUpload(albumId, files, onFileUploaded?)` -- creates/reuses engine
- `cancel(albumId)` / `cancelAll()`
- `retryFailed(albumId)`
- `getState()` -- returns combined state across all albums
- `subscribe(listener)` / `unsubscribe(listener)`
- Registers `beforeunload` event to warn user when uploads are active
- Lives outside React -- survives navigation

### 2. New file: `src/contexts/UploadManagerContext.tsx` -- React Bridge

- Creates React context wrapping the singleton
- `UploadManagerProvider` component that subscribes to the singleton and exposes state via `useSyncExternalStore` or simple `useState` + listener pattern
- `useUploadManager()` hook for components to access upload state and actions

### 3. New file: `src/components/admin/GlobalUploadBar.tsx` -- Floating UI

- Fixed-position bar at bottom-right of screen
- Only renders when there are active/recent uploads
- Shows per-album: progress %, active count, failed count, cancel button
- Collapsible (minimize to just a progress indicator)
- Visible on ALL admin pages (rendered inside AdminLayout)
- Click expands to show full `UploadProgressPanel`

### 4. Modified: `src/components/admin/MediaUploader.tsx`

- Remove `engineRef`, `uploadState`, and `handleStateUpdate` local state
- Import `useUploadManager()` instead
- `startUpload` calls `uploadManager.startUpload(albumId, files, onFileUploaded)`
- Cancel/retry/clear delegate to the manager
- Still renders the dropzone and folder picker (file selection UI stays here)
- No longer renders `UploadProgressPanel` inline (the global bar handles it)

### 5. Modified: `src/components/admin/AdminLayout.tsx`

- Add `<GlobalUploadBar />` inside the layout, after the main content area
- This ensures the bar is visible on every admin page

### 6. Modified: `src/App.tsx`

- Wrap admin routes (or the entire app) with `<UploadManagerProvider>`

### 7. No changes to:

- `src/lib/uploadEngine.ts` -- the engine class itself is unchanged
- R2 upload logic, CORS config
- Retry limit (3), concurrency (4-8 dynamic)
- Edge functions

## Key Behaviors

- **Navigate away**: uploads continue, floating bar shows progress
- **Come back to album**: MediaUploader reads state from context, shows current progress
- **Browser close**: `beforeunload` warns if uploads are running
- **Component unmount**: no cleanup cancels uploads (removed any cleanup effect)
- **Multiple albums**: supports concurrent uploads to different albums
- **Cancel**: only via explicit user action (cancel button in floating bar or MediaUploader)

## Technical Notes

- The singleton pattern avoids Zustand/Redux dependencies -- no new packages needed
- `useSyncExternalStore` (React 18) provides the cleanest React integration with external stores
- The `UploadEngine` class already handles its own `AbortController` per file, retry logic, and progress tracking -- the manager just orchestrates multiple engines
- IndexedDB persistence for surviving page reloads is deferred (the user's primary concern is navigation, not full reload). The `beforeunload` warning covers the reload case

