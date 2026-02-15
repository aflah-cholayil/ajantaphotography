import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// R2 only
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

interface DeleteRequest {
  action: "delete_media" | "delete_album" | "delete_client" | "cleanup_expired" | "bulk_delete_media";
  mediaId?: string;
  mediaIds?: string[];
  albumId?: string;
  clientId?: string;
  softDelete?: boolean;
}

interface MediaRecord {
  id: string;
  s3_key: string;
  s3_preview_key: string | null;
  size: number;
  file_name: string;
  album_id: string;
}

interface AlbumRecord {
  id: string;
  title: string;
  client_id: string;
  cover_image_key: string | null;
}

interface ClientRecord {
  id: string;
  event_name: string;
  user_id: string;
}

interface PersonRecord {
  face_thumbnail_key: string | null;
}

interface ProfileRecord {
  name: string;
}

async function deleteStorageObject(s3Key: string): Promise<boolean> {
  try {
    const deleteUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
    const deleteReq = await r2Client.sign(deleteUrl, { method: "DELETE" });
    const response = await fetch(deleteReq.url, { method: "DELETE", headers: deleteReq.headers });
    console.log(`Deleted R2 object: ${s3Key}, status: ${response.status}`);
    return response.ok || response.status === 404;
  } catch (error) {
    console.error(`Failed to delete R2 object ${s3Key}:`, error);
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function deleteMediaFromStorage(
  supabase: SupabaseClient<any>,
  mediaId: string,
  userId: string,
  albumName?: string
): Promise<{ success: boolean; s3Keys: string[]; totalSize: number }> {
  const { data, error } = await supabase
    .from("media")
    .select("id, s3_key, s3_preview_key, size, file_name, album_id")
    .eq("id", mediaId)
    .single();

  if (error || !data) {
    console.error("Media not found:", mediaId);
    return { success: false, s3Keys: [], totalSize: 0 };
  }

  const media = data as MediaRecord;
  const s3Keys: string[] = [];

  if (media.s3_key) {
    await deleteStorageObject(media.s3_key);
    s3Keys.push(media.s3_key);
  }

  if (media.s3_preview_key) {
    await deleteStorageObject(media.s3_preview_key);
    s3Keys.push(media.s3_preview_key);
  }

  await supabase.from("detected_faces").delete().eq("media_id", mediaId);
  await supabase.from("media_favorites").delete().eq("media_id", mediaId);

  const { error: deleteError } = await supabase.from("media").delete().eq("id", mediaId);

  if (deleteError) {
    console.error("Failed to delete media record:", deleteError);
    return { success: false, s3Keys, totalSize: media.size || 0 };
  }

  await supabase.from("deletion_logs").insert({
    deleted_by: userId,
    entity_type: "media",
    entity_id: mediaId,
    entity_name: media.file_name,
    parent_entity_id: media.album_id,
    parent_entity_name: albumName,
    s3_keys_deleted: s3Keys,
    files_count: 1,
    total_size_bytes: media.size || 0,
  });

  return { success: true, s3Keys, totalSize: media.size || 0 };
}

// deno-lint-ignore no-explicit-any
async function deleteAlbumFromStorage(
  supabase: SupabaseClient<any>,
  albumId: string,
  userId: string,
  softDelete: boolean = false,
  clientName?: string
): Promise<{ success: boolean; mediaCount: number; s3Keys: string[]; totalSize: number }> {
  console.log(`Deleting album: ${albumId}, softDelete: ${softDelete}`);

  const { data: albumData, error: albumError } = await supabase
    .from("albums")
    .select("id, title, client_id, cover_image_key")
    .eq("id", albumId)
    .single();

  if (albumError || !albumData) {
    return { success: false, mediaCount: 0, s3Keys: [], totalSize: 0 };
  }

  const album = albumData as AlbumRecord;

  const { data: mediaData, error: mediaError } = await supabase
    .from("media")
    .select("id, s3_key, s3_preview_key, size")
    .eq("album_id", albumId);

  if (mediaError) {
    return { success: false, mediaCount: 0, s3Keys: [], totalSize: 0 };
  }

  const mediaItems = (mediaData || []) as Array<{ id: string; s3_key: string; s3_preview_key: string | null; size: number }>;
  const allS3Keys: string[] = [];
  let totalSize = 0;

  if (!softDelete) {
    for (const media of mediaItems) {
      if (media.s3_key) {
        await deleteStorageObject(media.s3_key);
        allS3Keys.push(media.s3_key);
      }
      if (media.s3_preview_key) {
        await deleteStorageObject(media.s3_preview_key);
        allS3Keys.push(media.s3_preview_key);
      }
      totalSize += media.size || 0;
    }

    if (album.cover_image_key) {
      await deleteStorageObject(album.cover_image_key);
      allS3Keys.push(album.cover_image_key);
    }

    const { data: peopleData } = await supabase
      .from("people")
      .select("face_thumbnail_key")
      .eq("album_id", albumId);

    for (const person of (peopleData || []) as PersonRecord[]) {
      if (person.face_thumbnail_key) {
        await deleteStorageObject(person.face_thumbnail_key);
        allS3Keys.push(person.face_thumbnail_key);
      }
    }
  }

  await supabase.from("media_favorites").delete().eq("album_id", albumId);
  await supabase.from("detected_faces").delete().eq("album_id", albumId);
  await supabase.from("people").delete().eq("album_id", albumId);
  await supabase.from("share_links").delete().eq("album_id", albumId);
  await supabase.from("media").delete().eq("album_id", albumId);

  if (softDelete) {
    await supabase
      .from("albums")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", albumId);
  } else {
    await supabase.from("albums").delete().eq("id", albumId);
  }

  await supabase.from("deletion_logs").insert({
    deleted_by: userId,
    entity_type: "album",
    entity_id: albumId,
    entity_name: album.title,
    parent_entity_id: album.client_id,
    parent_entity_name: clientName,
    s3_keys_deleted: allS3Keys,
    files_count: mediaItems.length,
    total_size_bytes: totalSize,
  });

  return { success: true, mediaCount: mediaItems.length, s3Keys: allS3Keys, totalSize };
}

// deno-lint-ignore no-explicit-any
async function deleteClientFromStorage(
  supabase: SupabaseClient<any>,
  clientId: string,
  userId: string,
  softDelete: boolean = false
): Promise<{ success: boolean; albumCount: number; mediaCount: number; totalSize: number }> {
  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("id, event_name, user_id")
    .eq("id", clientId)
    .single();

  if (clientError || !clientData) {
    return { success: false, albumCount: 0, mediaCount: 0, totalSize: 0 };
  }

  const client = clientData as ClientRecord;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", client.user_id)
    .single();

  const clientName = (profileData as ProfileRecord | null)?.name || client.event_name;

  const { data: albumsData } = await supabase
    .from("albums")
    .select("id")
    .eq("client_id", clientId);

  const albums = (albumsData || []) as Array<{ id: string }>;
  let totalMediaCount = 0;
  let totalSize = 0;

  for (const album of albums) {
    const result = await deleteAlbumFromStorage(supabase, album.id, userId, false, clientName);
    totalMediaCount += result.mediaCount;
    totalSize += result.totalSize;
  }

  await supabase.from("email_logs").delete().eq("client_id", clientId);

  if (softDelete) {
    await supabase
      .from("clients")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", clientId);
  } else {
    await supabase.from("clients").delete().eq("id", clientId);
  }

  if (!softDelete) {
    await supabase.from("user_roles").delete().eq("user_id", client.user_id);
  }

  await supabase.from("deletion_logs").insert({
    deleted_by: userId,
    entity_type: "client",
    entity_id: clientId,
    entity_name: clientName,
    files_count: totalMediaCount,
    total_size_bytes: totalSize,
    metadata: { albums_deleted: albums.length },
  });

  return { success: true, albumCount: albums.length, mediaCount: totalMediaCount, totalSize };
}

// deno-lint-ignore no-explicit-any
async function cleanupExpiredAlbums(
  supabase: SupabaseClient<any>,
  systemUserId: string
): Promise<{ albumsDeleted: number; totalSize: number }> {
  const { data: expiredAlbumsData, error } = await supabase
    .from("albums")
    .select("id, title, client_id")
    .lt("expires_at", new Date().toISOString())
    .eq("is_deleted", false);

  if (error) {
    return { albumsDeleted: 0, totalSize: 0 };
  }

  const expiredAlbums = (expiredAlbumsData || []) as Array<{ id: string }>;
  let totalSize = 0;

  for (const album of expiredAlbums) {
    const result = await deleteAlbumFromStorage(supabase, album.id, systemUserId, false);
    totalSize += result.totalSize;
  }

  return { albumsDeleted: expiredAlbums.length, totalSize };
}

// deno-lint-ignore no-explicit-any
async function bulkDeleteMedia(
  supabase: SupabaseClient<any>,
  mediaIds: string[],
  albumId: string,
  userId: string
): Promise<{ success: boolean; deletedCount: number; totalSize: number; peopleRemoved: number }> {
  const BATCH_SIZE = 100;
  const allMedia: Array<{ id: string; s3_key: string; s3_preview_key: string | null; size: number; file_name: string }> = [];

  for (let i = 0; i < mediaIds.length; i += BATCH_SIZE) {
    const batch = mediaIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("media")
      .select("id, s3_key, s3_preview_key, size, file_name")
      .in("id", batch);

    if (error) continue;
    if (data) allMedia.push(...data);
  }

  if (allMedia.length === 0) {
    return { success: false, deletedCount: 0, totalSize: 0, peopleRemoved: 0 };
  }

  const allS3Keys: string[] = [];
  let totalSize = 0;

  for (const item of allMedia) {
    if (item.s3_key) {
      await deleteStorageObject(item.s3_key);
      allS3Keys.push(item.s3_key);
    }
    if (item.s3_preview_key) {
      await deleteStorageObject(item.s3_preview_key);
      allS3Keys.push(item.s3_preview_key);
    }
    totalSize += item.size || 0;
  }

  for (let i = 0; i < mediaIds.length; i += BATCH_SIZE) {
    const batch = mediaIds.slice(i, i + BATCH_SIZE);
    await supabase.from("detected_faces").delete().in("media_id", batch);
    await supabase.from("media_favorites").delete().in("media_id", batch);
    await supabase.from("media").delete().in("id", batch);
  }

  let peopleRemoved = 0;
  const { data: peopleData } = await supabase
    .from("people")
    .select("id")
    .eq("album_id", albumId);

  if (peopleData) {
    for (const person of peopleData) {
      const { count } = await supabase
        .from("detected_faces")
        .select("id", { count: "exact", head: true })
        .eq("person_id", person.id);

      if (count === 0) {
        const { data: personDetail } = await supabase
          .from("people")
          .select("face_thumbnail_key")
          .eq("id", person.id)
          .single();

        if (personDetail?.face_thumbnail_key) {
          await deleteStorageObject(personDetail.face_thumbnail_key);
        }

        await supabase.from("people").delete().eq("id", person.id);
        peopleRemoved++;
      } else {
        await supabase.from("people").update({ photo_count: count }).eq("id", person.id);
      }
    }
  }

  await supabase.from("deletion_logs").insert({
    deleted_by: userId,
    entity_type: "bulk_media",
    entity_id: albumId,
    entity_name: `${allMedia.length} files`,
    parent_entity_id: albumId,
    s3_keys_deleted: allS3Keys.slice(0, 500),
    files_count: allMedia.length,
    total_size_bytes: totalSize,
    metadata: { people_removed: peopleRemoved },
  });

  return { success: true, deletedCount: allMedia.length, totalSize, peopleRemoved };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string;

    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user }, error: authError } = await serviceClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await serviceClient.rpc("is_staff", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;
    } else {
      userId = "00000000-0000-0000-0000-000000000000";
    }

    const { action, mediaId, mediaIds, albumId, clientId, softDelete = false }: DeleteRequest = await req.json();

    switch (action) {
      case "delete_media": {
        if (!mediaId) {
          return new Response(JSON.stringify({ error: "mediaId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await deleteMediaFromStorage(serviceClient, mediaId, userId);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_album": {
        if (!albumId) {
          return new Response(JSON.stringify({ error: "albumId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await deleteAlbumFromStorage(serviceClient, albumId, userId, softDelete);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_client": {
        if (!clientId) {
          return new Response(JSON.stringify({ error: "clientId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await deleteClientFromStorage(serviceClient, clientId, userId, softDelete);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_expired": {
        const result = await cleanupExpiredAlbums(serviceClient, userId);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk_delete_media": {
        if (!mediaIds || mediaIds.length === 0 || !albumId) {
          return new Response(JSON.stringify({ error: "mediaIds and albumId required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await bulkDeleteMedia(serviceClient, mediaIds, albumId, userId);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in storage-cleanup:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
