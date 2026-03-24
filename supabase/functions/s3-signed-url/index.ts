import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function encodeStorageKey(key: string) {
  return key
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

function getStorageBaseUrl() {
  const endpoint = r2Endpoint.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${endpoint}/${r2Bucket}`;
}

function getObjectUrl(key: string) {
  return `${getStorageBaseUrl()}/${encodeStorageKey(key)}`;
}

async function signRequestForKey(key: string, method: "GET" | "HEAD") {
  const objectUrl = getObjectUrl(key);
  return await r2Client.sign(objectUrl, {
    method,
    headers: { host: new URL(objectUrl).host },
    aws: { signQuery: true },
  });
}

async function objectExists(key: string) {
  try {
    const signedHeadReq = await signRequestForKey(key, "HEAD");
    const headRes = await fetch(signedHeadReq.url, {
      method: "HEAD",
      headers: signedHeadReq.headers,
    });
    if (headRes.ok) return true;

    // Some R2 setups can reject HEAD for signed URLs while GET still works.
    const signedGetReq = await signRequestForKey(key, "GET");
    const getRes = await fetch(signedGetReq.url, {
      method: "GET",
      headers: signedGetReq.headers,
    });
    return getRes.ok;
  } catch {
    return false;
  }
}

function removeWebpSuffix(key: string) {
  return key.endsWith(".webp") ? key.slice(0, -5) : "";
}

async function resolveExistingObjectKey(primaryKey: string) {
  const fallbackCandidates = new Set<string>();

  const addCandidate = (candidate?: string) => {
    if (!candidate) return;
    const trimmed = candidate.trim();
    if (!trimmed) return;
    fallbackCandidates.add(trimmed);
  };

  addCandidate(primaryKey);

  const withoutWebp = removeWebpSuffix(primaryKey);
  addCandidate(withoutWebp);

  // Handle key format drift between:
  // - albums/{albumId}/originals/{file}
  // - {albumId}/originals/{file}
  // - {albumId}/{file}
  const albumsOriginalsMatch = primaryKey.match(/^albums\/([^/]+)\/originals\/(.+)$/);
  if (albumsOriginalsMatch) {
    const [, albumId, filePath] = albumsOriginalsMatch;
    addCandidate(`albums/${albumId}/${filePath}`);
    addCandidate(`${albumId}/originals/${filePath}`);
    addCandidate(`${albumId}/${filePath}`);
  }

  const albumsPlainMatch = primaryKey.match(/^albums\/([^/]+)\/(.+)$/);
  if (albumsPlainMatch) {
    const [, albumId, restPath] = albumsPlainMatch;
    addCandidate(`${albumId}/${restPath}`);
    addCandidate(`${albumId}/originals/${restPath}`);
  }

  const plainOriginalsMatch = primaryKey.match(/^([^/]+)\/originals\/(.+)$/);
  if (plainOriginalsMatch) {
    const [, albumId, filePath] = plainOriginalsMatch;
    addCandidate(`${albumId}/${filePath}`);
    addCandidate(`albums/${albumId}/originals/${filePath}`);
    addCandidate(`albums/${albumId}/${filePath}`);
  }

  const plainAlbumMatch = primaryKey.match(/^([^/]+)\/(.+)$/);
  if (plainAlbumMatch && !primaryKey.startsWith("albums/")) {
    const [, albumId, restPath] = plainAlbumMatch;
    addCandidate(`${albumId}/originals/${restPath}`);
    addCandidate(`albums/${albumId}/${restPath}`);
    addCandidate(`albums/${albumId}/originals/${restPath}`);
  }

  const keysToTry = [...fallbackCandidates];
  for (const key of keysToTry) {
    if (await objectExists(key)) return key;
  }

  return primaryKey;
}

function normalizeStorageKey(inputKey: string) {
  const trimmed = inputKey.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    let path = parsed.pathname.replace(/^\/+/, "");
    const bucketPrefix = `${r2Bucket}/`;
    if (path.startsWith(bucketPrefix)) {
      path = path.slice(bucketPrefix.length);
    }
    return decodeURIComponent(path);
  } catch {
    return trimmed;
  }
}

async function mediaKeyExists(supabase: ReturnType<typeof createClient>, albumId: string, key: string) {
  const { data: byKey } = await supabase
    .from("media")
    .select("id")
    .eq("album_id", albumId)
    .eq("s3_key", key)
    .limit(1)
    .maybeSingle();
  if (byKey) return true;

  const { data: byPreviewKey } = await supabase
    .from("media")
    .select("id")
    .eq("album_id", albumId)
    .eq("s3_preview_key", key)
    .limit(1)
    .maybeSingle();
  if (byPreviewKey) return true;

  const { data: byMediumKey } = await supabase
    .from("media")
    .select("id")
    .eq("album_id", albumId)
    .eq("s3_medium_key", key)
    .limit(1)
    .maybeSingle();
  return !!byMediumKey;
}

async function publicWorkKeyExists(supabase: ReturnType<typeof createClient>, key: string) {
  // Grant access if key belongs to an active work visible on gallery OR home (manage-work uses timestamp_filename format)
  const checkRow = (row: { status: string; show_on_gallery: boolean; show_on_home: boolean } | null) =>
    !!row && row.status === "active" && (row.show_on_gallery || row.show_on_home);

  const { data: byKey } = await supabase
    .from("works")
    .select("id, status, show_on_gallery, show_on_home")
    .eq("s3_key", key)
    .limit(1)
    .maybeSingle();
  if (checkRow(byKey)) return true;

  const { data: byPreviewKey } = await supabase
    .from("works")
    .select("id, status, show_on_gallery, show_on_home")
    .eq("s3_preview_key", key)
    .limit(1)
    .maybeSingle();
  return checkRow(byPreviewKey);
}

interface SignedUrlRequest {
  key?: string;
  albumId?: string;
  shareToken?: string;
  sharePassword?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let key = "";
    let albumId: string | undefined;
    let shareToken: string | undefined;
    let sharePassword: string | undefined;
    let isPublicAsset = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      key = url.searchParams.get("key") || "";
      albumId = url.searchParams.get("albumId") || undefined;
      shareToken = url.searchParams.get("shareToken") || undefined;
      sharePassword = url.searchParams.get("sharePassword") || undefined;
    } else {
      const body = (await req.json()) as SignedUrlRequest;
      const { key: requestKey } = body;
      key = requestKey || "";
      albumId = body.albumId;
      shareToken = body.shareToken;
      sharePassword = body.sharePassword;
    }

    console.log("Requested key:", key);

    if (!key || key === "undefined" || key === "null") {
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    key = normalizeStorageKey(key);
    key = await resolveExistingObjectKey(key);

    if (key.startsWith("assets/showcase_video/") || key.startsWith("assets/public/")) {
      isPublicAsset = true;
    }
    // Check works table: supports both "works/" prefix and manage-work format (timestamp_filename)
    if (!isPublicAsset) {
      isPublicAsset = await publicWorkKeyExists(supabase, key);
    }

    let hasAccess = isPublicAsset;
    const authHeader = req.headers.get("Authorization");
    let isAuthenticatedUser = false;

    if (!hasAccess && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const payload = decodeJwtPayload(token);
      let userId = payload?.sub as string | undefined;
      if (!userId) {
        const { data: userData } = await supabase.auth.getUser(token);
        userId = userData?.user?.id;
      }

      if (userId) {
        isAuthenticatedUser = true;
        const { data: isAdminRpc } = await supabase.rpc("is_admin_user", { _user_id: userId });
        if (isAdminRpc) {
          hasAccess = true;
        } else if (albumId) {
          const { data: clientRecord } = await supabase
            .from("clients")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (clientRecord?.id) {
            const { data: clientAlbum } = await supabase
              .from("albums")
              .select("id")
              .eq("id", albumId)
              .eq("client_id", clientRecord.id)
              .limit(1)
              .maybeSingle();
            if (clientAlbum) {
              hasAccess = await mediaKeyExists(supabase, albumId, key);
            }
          }
        }
      }
    }

    if (!hasAccess && shareToken && albumId) {
      const { data: shareLink } = await supabase
        .from("share_links")
        .select("*")
        .eq("token", shareToken)
        .eq("album_id", albumId)
        .limit(1)
        .maybeSingle();

      if (shareLink) {
        if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: "Link has expired" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (shareLink.password_hash) {
          if (!sharePassword) {
            return new Response(JSON.stringify({ error: "Password required" }), {
              status: 401,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          const isValidPassword = await bcrypt.compare(sharePassword, shareLink.password_hash);
          if (!isValidPassword) {
            return new Response(JSON.stringify({ error: "Invalid password" }), {
              status: 401,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        }

        hasAccess = await mediaKeyExists(supabase, albumId, key);
      }
    }

    if (!hasAccess && isAuthenticatedUser && albumId && key.startsWith(`${albumId}/`)) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const signedReq = await signRequestForKey(key, "GET");
    return new Response(JSON.stringify({ url: signedReq.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
