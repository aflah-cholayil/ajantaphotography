import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

    // Support both GET (for simple public assets) and POST (for authenticated access)
    if (req.method === "GET") {
      const url = new URL(req.url);
      s3Key = url.searchParams.get("key") || "";
      
      // Check if this is a public showcase asset (no auth required)
      if (s3Key.startsWith("assets/showcase_video/") || s3Key.startsWith("assets/public/")) {
        isPublicAsset = true;
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
        const userSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await userSupabase.auth.getUser();
        
        if (user) {
          const userId = user.id;

          // Check if admin
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .single();

          const adminRoles = ["admin", "owner", "editor"];
          if (roleData?.role && adminRoles.includes(roleData.role)) {
            hasAccess = true;
          } else if (albumId) {
            // Check if client owns this album
            const { data: album } = await supabase
              .from("albums")
              .select("client_id, clients!inner(user_id)")
              .eq("id", albumId)
              .single();

            if (album && (album as any).clients?.user_id === userId) {
              hasAccess = true;
            }
          }
        }
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
          // Check expiry
          if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "Link has expired" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          // Check password if required
          if (shareLink.password_hash) {
            if (!sharePassword) {
              return new Response(JSON.stringify({ error: "Password required" }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              });
            }
            // Verify password using bcrypt
            const isValidPassword = await bcrypt.compare(sharePassword, shareLink.password_hash);
            if (!isValidPassword) {
              return new Response(JSON.stringify({ error: "Invalid password" }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              });
            }
          }

          hasAccess = true;

          // Increment view count
          await supabase
            .from("share_links")
            .update({ view_count: shareLink.view_count + 1 })
            .eq("id", shareLink.id);
        }
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Generating signed URL for: ${s3Key}`);

    const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
    const signedReq = await aws.sign(objectUrl, {
      method: "GET",
      aws: {
        signQuery: true,
      },
    });

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
