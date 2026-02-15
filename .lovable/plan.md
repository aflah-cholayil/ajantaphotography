
# Increase Upload Concurrency + Dynamic Throttle

## Overview

Upgrade the upload engine from a fixed 4-concurrent-file limit to a dynamic 4-8 range based on real-time network speed measurement, while maintaining stability and correct UI reporting.

## Changes

### File: `src/lib/uploadEngine.ts`

**1. Constants Update**
- Change `MAX_CONCURRENT_FILES` from 4 to 8 (new max ceiling)
- Add `MIN_CONCURRENT_FILES = 4` (floor for slow networks)
- Add `SPEED_CHECK_INTERVAL = 5000` (measure speed every 5s)
- Add speed thresholds: `THROTTLE_DOWN_SPEED = 1 * 1024 * 1024` (1MB/s) and `THROTTLE_UP_SPEED = 5 * 1024 * 1024` (5MB/s)

**2. Dynamic Concurrency in `UploadEngine` class**
- Add private fields: `currentConcurrency = 8`, `speedSamples: number[]`, `lastSpeedCheck: number`
- Add a `measureSpeed()` method that calculates bytes/sec from `totalBytesUploaded` delta over the last interval
- In the `start()` and `retryFailed()` upload loops, replace the fixed `MAX_CONCURRENT_FILES` check with `this.currentConcurrency`
- After each file completes, call `adjustConcurrency()`:
  - If average speed < 1MB/s, reduce to 4
  - If average speed > 5MB/s, allow up to 8
  - Otherwise keep current value
- This is a simple approach -- no complex promise pool library needed, just adjusting the gate in the existing `while` loop

**3. Expose concurrency in state (for UI)**
- Add `activeConcurrency: number` to `UploadEngineState` interface
- Set it in `notify()` from `this.currentConcurrency`

**4. No changes to:**
- Retry limit (stays at 3)
- AbortController logic (already per-upload)
- File size validation (already done in `validateBatch`)
- R2 direct upload logic
- CORS configuration
- Progress calculation (already uses `bytesUploaded / totalBytes`)

### File: `src/components/admin/UploadProgressPanel.tsx`

- Display current concurrency next to the uploading count: e.g., "3 uploading (x8 slots)" so the user can see the dynamic throttle in action

### Technical Notes

```text
Speed < 1MB/s:  concurrency = 4  (protect slow connections)
Speed 1-5MB/s:  concurrency = unchanged (keep current)  
Speed > 5MB/s:  concurrency = 8  (maximize throughput)
```

- Speed is measured as a rolling average of the last 3 samples (15 seconds of data) to avoid jitter
- Concurrency adjustments only happen between file completions, not mid-upload
- No memory leak risk: speed samples array is capped at 3 entries
- No duplicate uploads: the existing `nextIndex` counter and `Promise.race` pattern prevents double-queuing
