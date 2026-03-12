import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// R2
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

async function signUrl(s3Key: string) {
  const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
  const signed = await r2Client.sign(objectUrl, { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

interface RequestBody {
  token: string;
  password?: string;
  action: "verify" | "load" | "get-signed-url";
  s3Key?: string;
  page?: number;
  pageSize?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, password, action, s3Key, page = 0, pageSize = 200 } = body;

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid share link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedToken = token.trim();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Processing share gallery request: action=${action}, token=${normalizedToken.substring(0, 8)}...`);

    const { data: shareLink, error: shareLinkError } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", normalizedToken)
      .maybeSingle();

    if (shareLinkError) {
      console.error("Error fetching share link:", shareLinkError);
      return new Response(
        JSON.stringify({ error: "An error occurred while loading the gallery" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!shareLink) {
      return new Response(
        JSON.stringify({ error: "This share link is invalid or has been removed" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "verify") {
      return new Response(
        JSON.stringify({
          valid: true,
          requiresPassword: !!shareLink.password_hash,
          allowDownload: shareLink.allow_download,
          albumId: shareLink.album_id,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify password if required
    if (shareLink.password_hash) {
      if (!password) {
        return new Response(
          JSON.stringify({ error: "Password required", requiresPassword: true }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const isValidPassword = bcrypt.compareSync(password, shareLink.password_hash);
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ error: "Incorrect password" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (action === "load") {
      const { data: album, error: albumError } = await supabase
        .from("albums")
        .select("id, title, description")
        .eq("id", shareLink.album_id)
        .maybeSingle();

      if (albumError || !album) {
        return new Response(
          JSON.stringify({ error: "This gallery does not exist" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get total count
      const { count: totalCount } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("album_id", shareLink.album_id);

      // Fetch media with pagination
      const clampedPageSize = Math.min(Math.max(pageSize, 1), 500);
      const from = page * clampedPageSize;
      const to = from + clampedPageSize - 1;

      const { data: media, error: mediaError } = await supabase
        .from("media")
        .select("id, file_name, s3_key, s3_preview_key, s3_medium_key, type, width, height, storage_provider")
        .eq("album_id", shareLink.album_id)
        .order("sort_order", { ascending: true })
        .range(from, to);

      if (mediaError) {
        console.error("Error fetching media:", mediaError);
      }

      // Generate signed URLs from R2
      const mediaWithUrls = await Promise.all(
        (media || []).map(async (item: any) => {
          const previewKey = item.s3_preview_key || item.s3_key;
          try {
            const url = await signUrl(previewKey);
            return { ...item, signedUrl: url };
          } catch (err) {
            console.error(`Error signing URL for ${item.id}:`, err);
            return { ...item, signedUrl: null };
          }
        })
      );

      // Only increment view count on first page load
      if (page === 0) {
        await supabase
          .from("share_links")
          .update({ view_count: (shareLink.view_count || 0) + 1 })
          .eq("id", shareLink.id);
      }

      const mediaCount = (media || []).length;
      const actualTotalCount = totalCount ?? 0;

      return new Response(
        JSON.stringify({
          album,
          media: mediaWithUrls,
          totalCount: actualTotalCount,
          page,
          hasMore: mediaCount === clampedPageSize && (from + mediaCount) < actualTotalCount,
          shareLink: {
            id: shareLink.id,
            allowDownload: shareLink.allow_download,
            viewCount: (shareLink.view_count || 0) + (page === 0 ? 1 : 0),
            downloadCount: shareLink.download_count,
          },
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "get-signed-url" && s3Key) {
      try {
        const url = await signUrl(s3Key);
        return new Response(
          JSON.stringify({ url }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (err) {
        console.error("Error generating signed URL:", err);
        return new Response(
          JSON.stringify({ error: "Failed to generate download URL" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in get-share-gallery function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred while loading the gallery" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
