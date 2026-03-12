import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickKeepRow(a, b) {
  const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) return aTime < bTime ? a : b;
  return String(a.id) <= String(b.id) ? a : b;
}

async function loadAllMedia() {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("media")
      .select("id,s3_key,created_at")
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function upsertFavoritesForKeptIds(dupToKeepMap, duplicateIds) {
  let moved = 0;

  for (const idsChunk of chunk(duplicateIds, 300)) {
    const { data: favRows, error: favReadErr } = await supabase
      .from("media_favorites")
      .select("media_id,user_id,created_at")
      .in("media_id", idsChunk);

    if (favReadErr) throw favReadErr;
    if (!favRows || favRows.length === 0) continue;

    const rowsToInsert = favRows
      .map((r) => ({
        media_id: dupToKeepMap.get(r.media_id),
        user_id: r.user_id,
        created_at: r.created_at ?? new Date().toISOString(),
      }))
      .filter((r) => !!r.media_id);

    if (rowsToInsert.length > 0) {
      const { error: favUpsertErr } = await supabase
        .from("media_favorites")
        .upsert(rowsToInsert, { onConflict: "media_id,user_id", ignoreDuplicates: true });

      if (favUpsertErr) throw favUpsertErr;
      moved += rowsToInsert.length;
    }

    const { error: favDeleteErr } = await supabase
      .from("media_favorites")
      .delete()
      .in("media_id", idsChunk);

    if (favDeleteErr) throw favDeleteErr;
  }

  return moved;
}

async function updateForeignKeys(tableName, duplicateIds, dupToKeepMap) {
  let updated = 0;

  for (const idsChunk of chunk(duplicateIds, 250)) {
    const { data: refs, error: readErr } = await supabase
      .from(tableName)
      .select("id,media_id")
      .in("media_id", idsChunk);

    if (readErr) throw readErr;
    if (!refs || refs.length === 0) continue;

    const byKeep = new Map();
    for (const row of refs) {
      const keepId = dupToKeepMap.get(row.media_id);
      if (!keepId) continue;
      if (!byKeep.has(keepId)) byKeep.set(keepId, []);
      byKeep.get(keepId).push(row.id);
    }

    for (const [keepId, rowIds] of byKeep.entries()) {
      for (const rowIdsChunk of chunk(rowIds, 200)) {
        const { error: updateErr } = await supabase
          .from(tableName)
          .update({ media_id: keepId })
          .in("id", rowIdsChunk);
        if (updateErr) throw updateErr;
        updated += rowIdsChunk.length;
      }
    }
  }

  return updated;
}

async function deleteDuplicateMediaRows(duplicateIds) {
  let deleted = 0;
  for (const idsChunk of chunk(duplicateIds, 300)) {
    const { error } = await supabase.from("media").delete().in("id", idsChunk);
    if (error) throw error;
    deleted += idsChunk.length;
  }
  return deleted;
}

async function main() {
  console.log("Loading media rows...");
  const allRows = await loadAllMedia();

  const keepByKey = new Map();
  const duplicateIds = [];
  const dupToKeepMap = new Map();

  for (const row of allRows) {
    const key = row.s3_key || "";
    const existing = keepByKey.get(key);
    if (!existing) {
      keepByKey.set(key, row);
      continue;
    }

    const keep = pickKeepRow(existing, row);
    const drop = keep.id === existing.id ? row : existing;

    keepByKey.set(key, keep);
    duplicateIds.push(drop.id);
    dupToKeepMap.set(drop.id, keep.id);
  }

  console.log(`Total media rows: ${allRows.length}`);
  console.log(`Distinct s3_key: ${keepByKey.size}`);
  console.log(`Duplicate rows to remove: ${duplicateIds.length}`);

  if (duplicateIds.length === 0) {
    console.log("No duplicates found. Nothing to do.");
    return;
  }

  console.log("Remapping media_favorites...");
  const favoritesMoved = await upsertFavoritesForKeptIds(dupToKeepMap, duplicateIds);
  console.log(`media_favorites remapped/inserted: ${favoritesMoved}`);

  console.log("Remapping edit_requests...");
  const editRequestsUpdated = await updateForeignKeys("edit_requests", duplicateIds, dupToKeepMap);
  console.log(`edit_requests updated: ${editRequestsUpdated}`);

  console.log("Remapping detected_faces...");
  const facesUpdated = await updateForeignKeys("detected_faces", duplicateIds, dupToKeepMap);
  console.log(`detected_faces updated: ${facesUpdated}`);

  console.log("Deleting duplicate media rows...");
  const deleted = await deleteDuplicateMediaRows(duplicateIds);
  console.log(`Deleted media rows: ${deleted}`);

  const { count, error } = await supabase.from("media").select("id", { count: "exact", head: true });
  if (error) throw error;
  console.log(`Final media row count: ${count}`);
  console.log("Deduplication complete.");
}

main().catch((err) => {
  console.error("Deduplication failed:", err?.message || err);
  process.exit(1);
});
