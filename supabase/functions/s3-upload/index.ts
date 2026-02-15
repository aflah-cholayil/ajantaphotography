import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const bucketName = Deno.env.get("AWS_BUCKET_NAME")!;

const aws = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
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
    // Verify authentication
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

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = user.id;

    // Check if user is admin using service role
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const allowedRoles = ["admin", "owner", "editor"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { albumId, fileName, fileType, fileSize, isPreview }: UploadRequest = await req.json();

    // Generate unique S3 key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const prefix = isPreview ? "previews" : "originals";
    const s3Key = `albums/${albumId}/${prefix}/${timestamp}_${sanitizedFileName}`;

    console.log(`Generating presigned URL for: ${s3Key}`);

    const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;

    // Generate presigned URL for upload (PUT)
    const signedReq = await aws.sign(objectUrl, {
      method: "PUT",
      headers: {
        "Content-Type": fileType,
      },
      aws: {
        signQuery: true,
      },
    });

    const presignedUrl = signedReq.url;

    return new Response(
      JSON.stringify({
        presignedUrl,
        s3Key,
        bucket: bucketName,
        region: awsRegion,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in s3-upload function:", error);
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
