import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff",
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
];

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

    // Create user-scoped client for getClaims
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Service role client for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is staff
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!roleData?.role || !["admin", "owner", "editor"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Staff access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { editRequestId, fileName, fileType, fileSize } = await req.json();

    if (!editRequestId || !fileName || !fileType || !fileSize) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(fileType)) {
      return new Response(JSON.stringify({ error: "Invalid file type. Only images and videos allowed." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the edit request
    const { data: editRequest, error: erError } = await supabase
      .from("edit_requests")
      .select("id, media_id, album_id, status")
      .eq("id", editRequestId)
      .single();

    if (erError || !editRequest) {
      return new Response(JSON.stringify({ error: "Edit request not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate S3 key for the edited file
    const timestamp = Date.now();
    const ext = fileName.split(".").pop() || "jpg";
    const s3Key = `albums/${editRequest.album_id}/edited/${editRequest.media_id}-edited-${timestamp}.${ext}`;

    // Generate presigned PUT URL
    const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
    const signedReq = await r2Client.sign(objectUrl, {
      method: "PUT",
      aws: { signQuery: true },
    });

    console.log(`[upload-edited-media] Generated presigned URL for: ${s3Key}`);

    return new Response(
      JSON.stringify({
        presignedUrl: signedReq.url,
        s3Key,
        editRequestId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("[upload-edited-media] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
