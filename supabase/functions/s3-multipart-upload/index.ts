import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AWS (legacy)
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const awsBucket = Deno.env.get("AWS_BUCKET_NAME")!;
const awsClient = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
  service: "s3",
});

// R2 (new uploads)
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

function getClient(provider: string) {
  return provider === "r2" ? r2Client : awsClient;
}

function getBaseUrl(provider: string) {
  return provider === "r2"
    ? `${r2Endpoint}/${r2Bucket}`
    : `https://${awsBucket}.s3.${awsRegion}.amazonaws.com`;
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

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
    throw new Error("Admin access required");
  }

  return user.id;
}

async function initiateMultipartUpload(s3Key: string, contentType: string, provider: string) {
  const client = getClient(provider);
  const baseUrl = getBaseUrl(provider);
  const url = `${baseUrl}/${s3Key}?uploads`;

  const signed = await client.sign(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
  });

  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error("Initiate multipart error:", text);
    throw new Error(`Failed to initiate multipart upload: ${res.status}`);
  }

  const xml = await res.text();
  const uploadIdMatch = xml.match(/<UploadId>(.+?)<\/UploadId>/);
  if (!uploadIdMatch) throw new Error("Could not parse UploadId from response");
  return uploadIdMatch[1];
}

async function getPartUploadUrl(s3Key: string, uploadId: string, partNumber: number, provider: string) {
  const client = getClient(provider);
  const baseUrl = getBaseUrl(provider);
  const url = `${baseUrl}/${s3Key}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;

  const signed = await client.sign(url, {
    method: "PUT",
    aws: { signQuery: true },
  });

  return signed.url;
}

async function completeMultipartUpload(s3Key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[], provider: string) {
  const client = getClient(provider);
  const baseUrl = getBaseUrl(provider);
  const url = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;

  const partsXml = parts
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
    .join("");

  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

  const signed = await client.sign(url, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body,
  });

  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error("Complete multipart error:", text);
    throw new Error(`Failed to complete multipart upload: ${res.status}`);
  }
  return true;
}

async function abortMultipartUpload(s3Key: string, uploadId: string, provider: string) {
  const client = getClient(provider);
  const baseUrl = getBaseUrl(provider);
  const url = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;

  const signed = await client.sign(url, { method: "DELETE" });
  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error("Abort multipart error:", text);
  }
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const { action, albumId, fileName, fileType, fileSize, s3Key, uploadId, partNumber, parts, storageProvider } = await req.json();

    // Default new uploads to R2, but support AWS for abort of legacy uploads
    const provider = storageProvider || "r2";

    if (action === "initiate") {
      if (!albumId || !fileName || !fileType) {
        return new Response(JSON.stringify({ error: "albumId, fileName, fileType required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const key = `albums/${albumId}/originals/${timestamp}_${sanitizedFileName}`;

      const uploadIdResult = await initiateMultipartUpload(key, fileType, "r2");

      return new Response(JSON.stringify({ uploadId: uploadIdResult, s3Key: key, storageProvider: "r2" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_part_url") {
      if (!s3Key || !uploadId || !partNumber) {
        return new Response(JSON.stringify({ error: "s3Key, uploadId, partNumber required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = await getPartUploadUrl(s3Key, uploadId, partNumber, provider);

      return new Response(JSON.stringify({ url }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      if (!s3Key || !uploadId || !parts) {
        return new Response(JSON.stringify({ error: "s3Key, uploadId, parts required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await completeMultipartUpload(s3Key, uploadId, parts, provider);

      return new Response(JSON.stringify({ success: true, s3Key, storageProvider: provider }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "abort") {
      if (!s3Key || !uploadId) {
        return new Response(JSON.stringify({ error: "s3Key, uploadId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await abortMultipartUpload(s3Key, uploadId, provider);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in s3-multipart-upload:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
