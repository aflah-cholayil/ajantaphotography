import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// R2 only — validate env vars
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;

console.log(`[s3-multipart] R2 env check: ENDPOINT=${!!r2Endpoint}, BUCKET=${!!r2Bucket}, ACCESS_KEY=${!!r2AccessKeyId}, SECRET_KEY=${!!r2SecretAccessKey}`);

const r2Client = new AwsClient({
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  region: "auto",
  service: "s3",
});

const baseUrl = `${r2Endpoint}/${r2Bucket}`;

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

async function initiateMultipartUpload(s3Key: string, contentType: string) {
  const url = `${baseUrl}/${s3Key}?uploads`;

  const signed = await r2Client.sign(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
  });

  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[s3-multipart] Initiate error for ${s3Key}: status=${res.status}, body=${text}`);
    throw new Error(`Failed to initiate multipart upload: ${res.status} - ${text}`);
  }

  const xml = await res.text();
  const uploadIdMatch = xml.match(/<UploadId>(.+?)<\/UploadId>/);
  if (!uploadIdMatch) throw new Error("Could not parse UploadId from response");
  return uploadIdMatch[1];
}

async function getPartUploadUrl(s3Key: string, uploadId: string, partNumber: number) {
  const url = `${baseUrl}/${s3Key}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;

  const signed = await r2Client.sign(url, {
    method: "PUT",
    headers: { host: new URL(url).host },
    aws: { signQuery: true },
  });

  return signed.url;
}

async function completeMultipartUpload(s3Key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
  const url = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;

  const partsXml = parts
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map(p => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
    .join("");

  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

  const signed = await r2Client.sign(url, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body,
  });

  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[s3-multipart] Complete error for ${s3Key}: status=${res.status}, body=${text}`);
    throw new Error(`Failed to complete multipart upload: ${res.status} - ${text}`);
  }
  return true;
}

async function abortMultipartUpload(s3Key: string, uploadId: string) {
  const url = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;

  const signed = await r2Client.sign(url, { method: "DELETE" });
  const res = await fetch(signed);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[s3-multipart] Abort error for ${s3Key}: status=${res.status}, body=${text}`);
  }
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const { action, albumId, fileName, fileType, fileSize, s3Key, uploadId, partNumber, parts } = await req.json();

    if (action === "initiate") {
      if (!albumId || !fileName || !fileType) {
        return new Response(JSON.stringify({ error: "albumId, fileName, fileType required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const key = `${albumId}/originals/${timestamp}_${sanitizedFileName}`;

      console.log(`[s3-multipart] Initiating upload: file=${fileName}, size=${fileSize}, key=${key}`);

      const uploadIdResult = await initiateMultipartUpload(key, fileType);

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

      const url = await getPartUploadUrl(s3Key, uploadId, partNumber);

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

      console.log(`[s3-multipart] Completing upload: key=${s3Key}, parts=${parts.length}`);
      await completeMultipartUpload(s3Key, uploadId, parts);

      return new Response(JSON.stringify({ success: true, s3Key, storageProvider: "r2" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "abort") {
      if (!s3Key || !uploadId) {
        return new Response(JSON.stringify({ error: "s3Key, uploadId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[s3-multipart] Aborting upload: key=${s3Key}`);
      await abortMultipartUpload(s3Key, uploadId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[s3-multipart] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
