import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// R2 config
const r2Endpoint = Deno.env.get("R2_ENDPOINT") || "";
const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "";
const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";

const r2 = new AwsClient({
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  region: "auto",
  service: "s3",
});

interface UploadRequest {
  albumId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isPreview?: boolean;
  action?: string;
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

    const body: UploadRequest = await req.json();

    // ===== TEST MODE: server-side PUT to verify R2 credentials =====
    if (body.action === "test") {
      console.log("[s3-upload] TEST MODE: verifying R2 connectivity");

      if (!r2Endpoint || !r2BucketName || !r2AccessKeyId || !r2SecretAccessKey) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing R2 environment variables",
          details: {
            hasEndpoint: !!r2Endpoint,
            hasBucket: !!r2BucketName,
            hasAccessKey: !!r2AccessKeyId,
            hasSecretKey: !!r2SecretAccessKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const testKey = `test/connectivity-test-${Date.now()}.txt`;
      const testUrl = `${r2Endpoint}/${r2BucketName}/${testKey}`;
      const testBody = "R2 connectivity test";

      try {
        // PUT test file
        const putReq = await r2.sign(testUrl, {
          method: "PUT",
          headers: { "Content-Type": "text/plain" },
          body: testBody,
        });

        const putResponse = await fetch(putReq.url, {
          method: "PUT",
          headers: putReq.headers,
          body: testBody,
        });

        const putStatus = putResponse.status;
        const putResponseText = await putResponse.text();

        console.log(`[s3-upload] TEST PUT status: ${putStatus}`);

        if (putStatus < 200 || putStatus >= 300) {
          return new Response(JSON.stringify({
            success: false,
            error: `R2 PUT failed with status ${putStatus}`,
            r2Status: putStatus,
            r2Response: putResponseText.substring(0, 500),
            endpoint: r2Endpoint.substring(0, 50) + "...",
            bucket: r2BucketName,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // DELETE test file
        try {
          const delReq = await r2.sign(testUrl, { method: "DELETE" });
          await fetch(delReq.url, { method: "DELETE", headers: delReq.headers });
        } catch (e) {
          console.warn("[s3-upload] Test file cleanup failed:", e);
        }

        return new Response(JSON.stringify({
          success: true,
          message: "R2 connectivity verified. Server-side PUT succeeded.",
          r2Status: putStatus,
          endpoint: r2Endpoint.substring(0, 50) + "...",
          bucket: r2BucketName,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (testError) {
        console.error("[s3-upload] TEST error:", testError);
        return new Response(JSON.stringify({
          success: false,
          error: testError instanceof Error ? testError.message : "Unknown test error",
          endpoint: r2Endpoint.substring(0, 50) + "...",
          bucket: r2BucketName,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // ===== NORMAL MODE: generate presigned URL =====
    const { albumId, fileName, fileType, fileSize, isPreview } = body;

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
      return new Response(JSON.stringify({ error: "Storage configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const objectUrl = `${r2Endpoint}/${r2BucketName}/${s3Key}`;

    try {
      const signedReq = await r2.sign(objectUrl, {
        method: "PUT",
        aws: { signQuery: true },
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
