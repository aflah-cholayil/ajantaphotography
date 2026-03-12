import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFromFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Always override runtime env with .env file values for recovery runs.
    process.env[key] = value;
  }
}

function readEnvMapFromFile() {
  const envPath = path.join(__dirname, ".env");
  const map = {};
  if (!fs.existsSync(envPath)) return map;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeEndpoint(endpoint) {
  return endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `https://${endpoint}`;
}

function guessMimeType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    webm: "video/webm",
    m4v: "video/x-m4v",
  };
  return map[ext] || "application/octet-stream";
}

function mediaTypeFromMime(mime) {
  return mime.startsWith("video/") ? "video" : "photo";
}

function parseAlbumAndFilename(key) {
  const match = key.match(/^albums\/([^/]+)\/originals\/(.+)$/);
  if (!match) return null;
  return {
    albumId: match[1],
    fileName: match[2],
  };
}

async function ensureRecoveryClient(supabase) {
  const ownerEmail = process.env.RECOVERY_OWNER_EMAIL || "aflahcholayil@gmail.com";

  let ownerUserId = null;

  const { data: ownerRoleRow, error: ownerRoleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (ownerRoleError) throw ownerRoleError;
  ownerUserId = ownerRoleRow?.user_id || null;

  if (!ownerUserId) {
    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", ownerEmail)
      .limit(1)
      .maybeSingle();
    if (ownerProfileError) throw ownerProfileError;
    ownerUserId = ownerProfile?.user_id || null;
  }

  if (!ownerUserId) {
    throw new Error(
      `No owner user found. Create an owner first or set RECOVERY_OWNER_EMAIL to an existing owner profile email.`,
    );
  }

  const { data: existingClient, error: existingClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", ownerUserId)
    .eq("event_name", "Recovered Albums")
    .limit(1)
    .maybeSingle();
  if (existingClientError) throw existingClientError;
  if (existingClient?.id) return existingClient.id;

  const { data: insertedClient, error: insertClientError } = await supabase
    .from("clients")
    .insert({
      user_id: ownerUserId,
      event_name: "Recovered Albums",
      notes: "Auto-created by recover-gallery.js",
    })
    .select("id")
    .single();
  if (insertClientError) throw insertClientError;
  return insertedClient.id;
}

async function listAllAlbumObjects(s3, bucket) {
  const results = [];
  let continuationToken = undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "albums/",
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const obj of res.Contents || []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      const parsed = parseAlbumAndFilename(obj.Key);
      if (!parsed) continue;
      results.push(obj);
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}

async function main() {
  loadEnvFromFile();
  const envMap = readEnvMapFromFile();

  const r2Endpoint = normalizeEndpoint(envMap.R2_ENDPOINT || requireEnv("R2_ENDPOINT"));
  const r2Bucket = envMap.R2_BUCKET_NAME || requireEnv("R2_BUCKET_NAME");
  const r2AccessKey = envMap.R2_ACCESS_KEY_ID || requireEnv("R2_ACCESS_KEY_ID");
  const r2SecretKey = envMap.R2_SECRET_ACCESS_KEY || requireEnv("R2_SECRET_ACCESS_KEY");

  const supabaseUrl = envMap.SUPABASE_URL || envMap.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = envMap.SUPABASE_SERVICE_ROLE_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
    },
    forcePathStyle: true,
  });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  console.log("Scanning R2 objects under albums/ ...");
  const objects = await listAllAlbumObjects(s3, r2Bucket);
  console.log(`Found ${objects.length} objects`);

  if (objects.length === 0) {
    console.log("No album objects found. Nothing to recover.");
    return;
  }

  const recoveryClientId = await ensureRecoveryClient(supabase);

  const byAlbum = new Map();
  for (const obj of objects) {
    const parsed = parseAlbumAndFilename(obj.Key);
    if (!parsed) continue;
    if (!byAlbum.has(parsed.albumId)) {
      byAlbum.set(parsed.albumId, []);
    }
    byAlbum.get(parsed.albumId).push({
      key: obj.Key,
      fileName: parsed.fileName,
      size: Number(obj.Size || 0),
      createdAt: obj.LastModified ? new Date(obj.LastModified).toISOString() : new Date().toISOString(),
    });
  }

  let insertedMediaCount = 0;
  let recoveredAlbumsCount = 0;

  for (const [albumId, files] of byAlbum.entries()) {
    const { error: albumUpsertError } = await supabase.from("albums").upsert(
      {
        id: albumId,
        client_id: recoveryClientId,
        title: `Recovered Album ${albumId.slice(0, 8)}`,
        description: "Recovered from Cloudflare R2 objects",
        status: "ready",
      },
      { onConflict: "id" },
    );
    if (albumUpsertError) {
      console.error(`Failed album upsert ${albumId}:`, albumUpsertError.message);
      continue;
    }

    recoveredAlbumsCount++;
    console.log(`Recovered album ${albumId}`);

    const { data: existingMediaRows, error: existingMediaError } = await supabase
      .from("media")
      .select("s3_key")
      .eq("album_id", albumId);
    if (existingMediaError) {
      console.error(`Failed loading existing media for album ${albumId}:`, existingMediaError.message);
      continue;
    }
    const existingKeys = new Set((existingMediaRows || []).map((r) => r.s3_key));

    for (const file of files) {
      if (existingKeys.has(file.key)) continue;

      const mimeType = guessMimeType(file.fileName);
      const type = mediaTypeFromMime(mimeType);

      const { error: mediaInsertError } = await supabase.from("media").insert({
        album_id: albumId,
        s3_key: file.key,
        file_name: file.fileName,
        mime_type: mimeType,
        size: file.size,
        type,
        created_at: file.createdAt,
      });

      if (mediaInsertError) {
        console.error(`Failed media insert ${file.key}:`, mediaInsertError.message);
        continue;
      }

      insertedMediaCount++;
      console.log(`Inserted media ${file.key}`);
    }
  }

  console.log("Recovery complete.");
  console.log(`Albums recovered: ${recoveredAlbumsCount}`);
  console.log(`Media inserted: ${insertedMediaCount}`);
}

main().catch((error) => {
  console.error("Recovery failed:", error.message || error);
  process.exit(1);
});
