import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  assetType: "showcase_video" | "hero_image" | "logo";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - Missing auth header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { 
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Authenticated user:", user.id);
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

    const { fileName, fileType, fileSize, assetType }: UploadRequest = await req.json();

    // Validate file type based on asset type
    if (assetType === "showcase_video") {
      const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
      if (!allowedVideoTypes.includes(fileType)) {
        return new Response(JSON.stringify({ error: "Invalid video format. Allowed: MP4, WebM, MOV" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      // Max 500MB for videos
      if (fileSize > 500 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Video file too large. Maximum 500MB allowed." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Generate unique S3 key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `assets/${assetType}/${timestamp}_${sanitizedFileName}`;

    console.log(`Generating presigned URL for asset: ${s3Key}`);

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
    console.error("Error in upload-asset function:", error);
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
