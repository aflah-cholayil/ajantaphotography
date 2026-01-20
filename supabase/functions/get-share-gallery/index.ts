import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const bucketName = Deno.env.get("AWS_BUCKET_NAME")!;

const aws = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
  service: "s3",
});

interface RequestBody {
  token: string;
  password?: string;
  action: "verify" | "load" | "get-signed-url";
  s3Key?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, password, action, s3Key } = body;

    // Validate token
    if (!token || typeof token !== "string") {
      console.log("Missing or invalid token");
      return new Response(
        JSON.stringify({ error: "Invalid share link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Trim and normalize token
    const normalizedToken = token.trim();
    
    // Initialize Supabase with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Processing share gallery request: action=${action}, token=${normalizedToken.substring(0, 8)}...`);

    // Fetch share link using service role (bypasses RLS)
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
      console.log("Share link not found for token:", normalizedToken.substring(0, 8));
      return new Response(
        JSON.stringify({ error: "This share link is invalid or has been removed" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check expiry
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      console.log("Share link expired:", shareLink.id);
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // VERIFY action - just check if share link exists and if password is required
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

    // For load and get-signed-url actions, verify password if required
    if (shareLink.password_hash) {
      if (!password) {
        return new Response(
          JSON.stringify({ error: "Password required", requiresPassword: true }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const isValidPassword = await bcrypt.compare(password, shareLink.password_hash);
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ error: "Incorrect password" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // LOAD action - fetch album and media data
    if (action === "load") {
      // Fetch album
      const { data: album, error: albumError } = await supabase
        .from("albums")
        .select("id, title, description")
        .eq("id", shareLink.album_id)
        .maybeSingle();

      if (albumError || !album) {
        console.error("Error fetching album:", albumError);
        return new Response(
          JSON.stringify({ error: "This gallery does not exist" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Fetch media
      const { data: media, error: mediaError } = await supabase
        .from("media")
        .select("id, file_name, s3_key, s3_preview_key, type, width, height")
        .eq("album_id", shareLink.album_id)
        .order("sort_order", { ascending: true });

      if (mediaError) {
        console.error("Error fetching media:", mediaError);
      }

      // Generate signed URLs for all media
      const mediaWithUrls = await Promise.all(
        (media || []).map(async (item) => {
          const previewKey = item.s3_preview_key || item.s3_key;
          try {
            const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${previewKey}`;
            const signedReq = await aws.sign(objectUrl, {
              method: "GET",
              aws: { signQuery: true },
            });
            return { ...item, signedUrl: signedReq.url };
          } catch (err) {
            console.error(`Error signing URL for ${item.id}:`, err);
            return { ...item, signedUrl: null };
          }
        })
      );

      // Increment view count
      await supabase
        .from("share_links")
        .update({ view_count: (shareLink.view_count || 0) + 1 })
        .eq("id", shareLink.id);

      console.log(`Gallery loaded: ${album.title} with ${mediaWithUrls.length} media items`);

      return new Response(
        JSON.stringify({
          album,
          media: mediaWithUrls,
          shareLink: {
            id: shareLink.id,
            allowDownload: shareLink.allow_download,
            viewCount: shareLink.view_count + 1,
            downloadCount: shareLink.download_count,
          },
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // GET-SIGNED-URL action - get signed URL for a specific media item
    if (action === "get-signed-url" && s3Key) {
      try {
        const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
        const signedReq = await aws.sign(objectUrl, {
          method: "GET",
          aws: { signQuery: true },
        });

        return new Response(
          JSON.stringify({ url: signedReq.url }),
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "An error occurred while loading the gallery" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
