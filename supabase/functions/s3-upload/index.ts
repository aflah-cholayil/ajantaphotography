import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// R2 config — validate env vars
const r2Endpoint = Deno.env.get("R2_ENDPOINT") || "";
const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "";
const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";

console.log(`[s3-upload] R2 env check: ENDPOINT=${!!r2Endpoint}, BUCKET=${!!r2BucketName}, ACCESS_KEY=${!!r2AccessKeyId}, SECRET_KEY=${!!r2SecretAccessKey}`);
if (r2Endpoint) {
  console.log(`[s3-upload] R2_ENDPOINT format: ${r2Endpoint.replace(/\/\/.*@/, "//***@").substring(0, 60)}...`);
}

const r2 = new AwsClient({
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  region: "auto",
  service: "s3",
});

interface UploadRequest {
  albumId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  isPreview?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData?.role || !["admin", "owner", "editor"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { albumId, fileName, fileType, fileSize, isPreview }: UploadRequest = await req.json();

    if (!albumId || !fileName || !fileType || !fileSize) {
      return new Response(JSON.stringify({ error: "Missing required fields: albumId, fileName, fileType, fileSize" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const prefix = isPreview ? "previews" : "originals";
    const s3Key = `albums/${albumId}/${prefix}/${timestamp}_${sanitizedFileName}`;

    console.log(`[s3-upload] Generating R2 presigned URL: file=${fileName}, size=${fileSize}, key=${s3Key}`);

    if (!r2Endpoint || !r2BucketName) {
      console.error("[s3-upload] Missing R2_ENDPOINT or R2_BUCKET_NAME");
      return new Response(JSON.stringify({ error: "Storage configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const objectUrl = `${r2Endpoint}/${r2BucketName}/${s3Key}`;

    try {
      const signedReq = await r2.sign(objectUrl, {
        method: "PUT",
        headers: {
          "Content-Type": fileType,
          "Content-Length": String(fileSize),
          "X-Amz-Expires": "3600",
        },
        aws: {
          signQuery: true,
        },
      });

      const presignedUrl = signedReq.url;

      console.log(`[s3-upload] Presigned URL generated successfully for: ${s3Key}`);

      return new Response(
        JSON.stringify({
          presignedUrl,
          s3Key,
          bucket: r2BucketName,
          region: "auto",
          storageProvider: "r2",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } catch (signError) {
      console.error(`[s3-upload] Signing error for ${s3Key}:`, signError);
      const signMsg = signError instanceof Error ? signError.message : "Signing failed";
      return new Response(JSON.stringify({ error: `Signing error: ${signMsg}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: unknown) {
    console.error("[s3-upload] Error:", error);
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
