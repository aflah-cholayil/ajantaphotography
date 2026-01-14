import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.540.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.540.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

const bucketName = Deno.env.get("AWS_BUCKET_NAME")!;

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

    const { s3Key, expiresIn = 3600, albumId, shareToken, sharePassword }: SignedUrlRequest = await req.json();

    let hasAccess = false;

    // Check authentication first
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader?.startsWith("Bearer ")) {
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await userSupabase.auth.getClaims(token);
      
      if (claims?.claims) {
        const userId = claims.claims.sub as string;

        // Check if admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();

        if (roleData?.role === "admin") {
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
          // Simple password check (in production, use bcrypt)
          if (shareLink.password_hash !== sharePassword) {
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

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Generating signed URL for: ${s3Key}`);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return new Response(
      JSON.stringify({ presignedUrl, expiresIn }),
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
