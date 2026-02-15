import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const awsRegion = Deno.env.get("AWS_REGION") || "ap-south-1";
const bucketName = Deno.env.get("AWS_BUCKET_NAME")!;

const aws = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
  service: "s3",
});

interface DeleteRequest {
  action: "delete_media" | "delete_album" | "delete_client" | "cleanup_expired";
  mediaId?: string;
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

async function deleteS3Object(s3Key: string): Promise<boolean> {
  try {
    const deleteUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
    const deleteReq = await aws.sign(deleteUrl, { method: "DELETE" });
    const response = await fetch(deleteReq.url, { method: "DELETE", headers: deleteReq.headers });
    console.log(`Deleted S3 object: ${s3Key}, status: ${response.status}`);
    return response.ok || response.status === 404;
  } catch (error) {
    console.error(`Failed to delete S3 object ${s3Key}:`, error);
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function deleteMediaFromS3(
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
    await deleteS3Object(media.s3_key);
    s3Keys.push(media.s3_key);
  }

  if (media.s3_preview_key) {
    await deleteS3Object(media.s3_preview_key);
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

  console.log(`Deleted media: ${mediaId}, S3 keys: ${s3Keys.join(", ")}`);
  return { success: true, s3Keys, totalSize: media.size || 0 };
}

// deno-lint-ignore no-explicit-any
async function deleteAlbumFromS3(
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
    console.error("Album not found:", albumId);
    return { success: false, mediaCount: 0, s3Keys: [], totalSize: 0 };
  }

  const album = albumData as AlbumRecord;

  const { data: mediaData, error: mediaError } = await supabase
    .from("media")
    .select("id, s3_key, s3_preview_key, size")
    .eq("album_id", albumId);

  if (mediaError) {
    console.error("Error fetching media:", mediaError);
    return { success: false, mediaCount: 0, s3Keys: [], totalSize: 0 };
  }

  const mediaItems = (mediaData || []) as Array<{ id: string; s3_key: string; s3_preview_key: string | null; size: number }>;
  const allS3Keys: string[] = [];
  let totalSize = 0;

  if (!softDelete) {
    for (const media of mediaItems) {
      if (media.s3_key) {
        await deleteS3Object(media.s3_key);
        allS3Keys.push(media.s3_key);
      }
      if (media.s3_preview_key) {
        await deleteS3Object(media.s3_preview_key);
        allS3Keys.push(media.s3_preview_key);
      }
      totalSize += media.size || 0;
    }

    if (album.cover_image_key) {
      await deleteS3Object(album.cover_image_key);
      allS3Keys.push(album.cover_image_key);
    }

    const { data: peopleData } = await supabase
      .from("people")
      .select("face_thumbnail_key")
      .eq("album_id", albumId);

    for (const person of (peopleData || []) as PersonRecord[]) {
      if (person.face_thumbnail_key) {
        await deleteS3Object(person.face_thumbnail_key);
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

  console.log(`Deleted album: ${albumId}, ${mediaItems.length} files, ${allS3Keys.length} S3 objects`);
  return { success: true, mediaCount: mediaItems.length, s3Keys: allS3Keys, totalSize };
}

// deno-lint-ignore no-explicit-any
async function deleteClientFromS3(
  supabase: SupabaseClient<any>,
  clientId: string,
  userId: string,
  softDelete: boolean = false
): Promise<{ success: boolean; albumCount: number; mediaCount: number; totalSize: number }> {
  console.log(`Deleting client: ${clientId}, softDelete: ${softDelete}`);

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("id, event_name, user_id")
    .eq("id", clientId)
    .single();

  if (clientError || !clientData) {
    console.error("Client not found:", clientId);
    return { success: false, albumCount: 0, mediaCount: 0, totalSize: 0 };
  }

  const client = clientData as ClientRecord;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", client.user_id)
    .single();

  const profile = profileData as ProfileRecord | null;
  const clientName = profile?.name || client.event_name;

  const { data: albumsData, error: albumsError } = await supabase
    .from("albums")
    .select("id")
    .eq("client_id", clientId);

  if (albumsError) {
    console.error("Error fetching albums:", albumsError);
    return { success: false, albumCount: 0, mediaCount: 0, totalSize: 0 };
  }

  const albums = (albumsData || []) as Array<{ id: string }>;
  let totalMediaCount = 0;
  let totalSize = 0;

  for (const album of albums) {
    const result = await deleteAlbumFromS3(supabase, album.id, userId, false, clientName);
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

  console.log(`Deleted client: ${clientId}, ${albums.length} albums, ${totalMediaCount} files`);
  return { success: true, albumCount: albums.length, mediaCount: totalMediaCount, totalSize };
}

// deno-lint-ignore no-explicit-any
async function cleanupExpiredAlbums(
  supabase: SupabaseClient<any>,
  systemUserId: string
): Promise<{ albumsDeleted: number; totalSize: number }> {
  console.log("Running expired albums cleanup...");

  const { data: expiredAlbumsData, error } = await supabase
    .from("albums")
    .select("id, title, client_id")
    .lt("expires_at", new Date().toISOString())
    .eq("is_deleted", false);

  if (error) {
    console.error("Error finding expired albums:", error);
    return { albumsDeleted: 0, totalSize: 0 };
  }

  const expiredAlbums = (expiredAlbumsData || []) as Array<{ id: string; title: string; client_id: string }>;
  let totalSize = 0;

  for (const album of expiredAlbums) {
    const result = await deleteAlbumFromS3(supabase, album.id, systemUserId, false);
    totalSize += result.totalSize;
  }

  console.log(`Cleanup complete: ${expiredAlbums.length} albums deleted`);
  return { albumsDeleted: expiredAlbums.length, totalSize };
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
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await serviceClient.rpc("is_staff", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;
    } else {
      userId = "00000000-0000-0000-0000-000000000000";
    }

    const { action, mediaId, albumId, clientId, softDelete = false }: DeleteRequest = await req.json();

    console.log(`Storage cleanup action: ${action}`, { mediaId, albumId, clientId, softDelete });

    switch (action) {
      case "delete_media": {
        if (!mediaId) {
          return new Response(JSON.stringify({ error: "mediaId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await deleteMediaFromS3(serviceClient, mediaId, userId);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_album": {
        if (!albumId) {
          return new Response(JSON.stringify({ error: "albumId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await deleteAlbumFromS3(serviceClient, albumId, userId, softDelete);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_client": {
        if (!clientId) {
          return new Response(JSON.stringify({ error: "clientId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await deleteClientFromS3(serviceClient, clientId, userId, softDelete);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_expired": {
        const result = await cleanupExpiredAlbums(serviceClient, userId);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in storage-cleanup:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
