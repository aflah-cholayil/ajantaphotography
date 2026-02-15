import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Decode JWT payload without verification (gateway already verified)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

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

function getSignedUrl(s3Key: string) {
  const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
  return r2Client.sign(objectUrl, { method: "GET", aws: { signQuery: true } });
}

interface SignedUrlRequest {
  s3Key: string;
  expiresIn?: number;
  albumId?: string;
  shareToken?: string;
  sharePassword?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let s3Key: string;
    let expiresIn = 3600;
    let albumId: string | undefined;
    let shareToken: string | undefined;
    let sharePassword: string | undefined;
    let isPublicAsset = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      s3Key = url.searchParams.get("key") || "";
      
      if (s3Key.startsWith("assets/showcase_video/") || s3Key.startsWith("assets/public/")) {
        isPublicAsset = true;
      }
      
      if (s3Key.startsWith("works/") || s3Key.startsWith("works/previews/")) {
        const { data: work } = await supabase
          .from("works")
          .select("id, status, show_on_gallery")
          .or(`s3_key.eq.${s3Key},s3_preview_key.eq.${s3Key}`)
          .single();
        
        if (work && work.status === "active" && work.show_on_gallery) {
          isPublicAsset = true;
        }
      }
    } else {
      const body = await req.json();
      s3Key = body.s3Key;
      expiresIn = body.expiresIn || 3600;
      albumId = body.albumId;
      shareToken = body.shareToken;
      sharePassword = body.sharePassword;
    }

    if (!s3Key) {
      return new Response(JSON.stringify({ error: "Missing s3Key or key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let hasAccess = isPublicAsset;

    // Check authentication if not a public asset
    if (!hasAccess) {
      const authHeader = req.headers.get("Authorization");
      
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        
        // Decode JWT locally instead of calling getUser() to avoid
        // overwhelming the auth service with concurrent requests
        const payload = decodeJwtPayload(token);
        const userId = payload?.sub as string | undefined;
        
        if (!userId) {
          console.warn(`[s3-signed-url] Could not decode JWT for key=${s3Key}`);
        }
        
        if (userId) {
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .single();

          if (roleError) {
            console.warn(`[s3-signed-url] role lookup failed for user=${userId}: ${roleError.message}`);
          }

          const adminRoles = ["admin", "owner", "editor"];
          if (roleData?.role && adminRoles.includes(roleData.role)) {
            hasAccess = true;
          } else if (albumId) {
            const { data: album } = await supabase
              .from("albums")
              .select("id, client_id, clients(user_id)")
              .eq("id", albumId)
              .single();

            if (album && (album as any).clients?.user_id === userId) {
              const { data: mediaItem } = await supabase
                .from("media")
                .select("id")
                .eq("album_id", albumId)
                .or(`s3_key.eq.${s3Key},s3_preview_key.eq.${s3Key}`)
                .single();
              
              const { data: personItem } = await supabase
                .from("people")
                .select("id")
                .eq("album_id", albumId)
                .eq("face_thumbnail_key", s3Key)
                .single();
              
              const { data: coverCheck } = await supabase
                .from("albums")
                .select("id")
                .eq("id", albumId)
                .eq("cover_image_key", s3Key)
                .single();

              if (mediaItem || personItem || coverCheck) {
                hasAccess = true;
              }
            }
          }
        }
      } else {
        console.warn(`[s3-signed-url] No auth header for non-public key=${s3Key}`);
      }

      // Check share token access
      if (!hasAccess && shareToken && albumId) {
        const { data: shareLink } = await supabase
          .from("share_links")
          .select("*")
          .eq("token", shareToken)
          .eq("album_id", albumId)
          .single();

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

          const { data: mediaItem } = await supabase
            .from("media")
            .select("id")
            .eq("album_id", albumId)
            .or(`s3_key.eq.${s3Key},s3_preview_key.eq.${s3Key}`)
            .single();
          
          const { data: personItem } = await supabase
            .from("people")
            .select("id")
            .eq("album_id", albumId)
            .eq("face_thumbnail_key", s3Key)
            .single();
          
          const { data: coverCheck } = await supabase
            .from("albums")
            .select("id")
            .eq("id", albumId)
            .eq("cover_image_key", s3Key)
            .single();

          if (mediaItem || personItem || coverCheck) {
            hasAccess = true;
            await supabase
              .from("share_links")
              .update({ view_count: shareLink.view_count + 1 })
              .eq("id", shareLink.id);
          }
        }
      }
    }

    if (!hasAccess) {
      console.warn(`[s3-signed-url] Access denied for key=${s3Key}, albumId=${albumId}, shareToken=${shareToken ? 'yes' : 'no'}`);
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Generating signed URL for: ${s3Key} (provider: r2)`);

    const signedReq = await getSignedUrl(s3Key);
    const presignedUrl = signedReq.url;

    return new Response(
      JSON.stringify({ url: presignedUrl, expiresIn }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in s3-signed-url function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
