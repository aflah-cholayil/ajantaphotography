import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 20; // Process 20 files per invocation to avoid timeouts

// AWS
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const awsBucket = Deno.env.get("AWS_BUCKET_NAME")!;
const awsClient = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
  service: "s3",
});

// R2
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

async function downloadFromAws(s3Key: string): Promise<Response> {
  const objectUrl = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
  const signedReq = await awsClient.sign(objectUrl, { method: "GET", aws: { signQuery: true } });
  return fetch(signedReq.url);
}

async function uploadToR2(s3Key: string, body: ReadableStream | ArrayBuffer, contentType: string): Promise<boolean> {
  const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
  const signedReq = await r2Client.sign(objectUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    aws: { signQuery: true },
  });

  const res = await fetch(signedReq.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  return res.ok;
}

async function verifyR2Exists(s3Key: string): Promise<boolean> {
  const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
  const signedReq = await r2Client.sign(objectUrl, { method: "HEAD", aws: { signQuery: true } });
  const res = await fetch(signedReq.url, { method: "HEAD" });
  return res.ok;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Owner only
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "owner") {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "status") {
      // Count files by provider
      const { count: awsMediaCount } = await adminClient
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("storage_provider", "aws");

      const { count: r2MediaCount } = await adminClient
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("storage_provider", "r2");

      const { count: awsWorksCount } = await adminClient
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("storage_provider", "aws");

      const { count: r2WorksCount } = await adminClient
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("storage_provider", "r2");

      return new Response(JSON.stringify({
        media: { aws: awsMediaCount || 0, r2: r2MediaCount || 0 },
        works: { aws: awsWorksCount || 0, r2: r2WorksCount || 0 },
        totalRemaining: (awsMediaCount || 0) + (awsWorksCount || 0),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start") {
      let migrated = 0;
      let failed = 0;
      const errors: string[] = [];

      // Migrate media files
      const { data: awsMedia } = await adminClient
        .from("media")
        .select("id, s3_key, s3_preview_key, mime_type")
        .eq("storage_provider", "aws")
        .limit(BATCH_SIZE);

      for (const item of awsMedia || []) {
        try {
          // Migrate main file
          const mainRes = await downloadFromAws(item.s3_key);
          if (!mainRes.ok) throw new Error(`Download failed: ${mainRes.status}`);
          
          const mainBody = await mainRes.arrayBuffer();
          const uploaded = await uploadToR2(item.s3_key, mainBody, item.mime_type || "application/octet-stream");
          if (!uploaded) throw new Error("R2 upload failed");

          const verified = await verifyR2Exists(item.s3_key);
          if (!verified) throw new Error("R2 verification failed");

          // Migrate preview if exists
          if (item.s3_preview_key) {
            try {
              const previewRes = await downloadFromAws(item.s3_preview_key);
              if (previewRes.ok) {
                const previewBody = await previewRes.arrayBuffer();
                await uploadToR2(item.s3_preview_key, previewBody, item.mime_type || "application/octet-stream");
              }
            } catch (e) {
              console.warn(`Preview migration failed for ${item.id}:`, e);
            }
          }

          // Update DB
          await adminClient
            .from("media")
            .update({ storage_provider: "r2" })
            .eq("id", item.id);

          migrated++;
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`media:${item.id}: ${msg}`);
          console.error(`Migration failed for media ${item.id}:`, msg);
        }
      }

      // Migrate works files if we have capacity left
      const remaining = BATCH_SIZE - (migrated + failed);
      if (remaining > 0) {
        const { data: awsWorks } = await adminClient
          .from("works")
          .select("id, s3_key, s3_preview_key, mime_type")
          .eq("storage_provider", "aws")
          .limit(remaining);

        for (const item of awsWorks || []) {
          try {
            const mainRes = await downloadFromAws(item.s3_key);
            if (!mainRes.ok) throw new Error(`Download failed: ${mainRes.status}`);
            
            const mainBody = await mainRes.arrayBuffer();
            const uploaded = await uploadToR2(item.s3_key, mainBody, item.mime_type || "application/octet-stream");
            if (!uploaded) throw new Error("R2 upload failed");

            const verified = await verifyR2Exists(item.s3_key);
            if (!verified) throw new Error("R2 verification failed");

            if (item.s3_preview_key) {
              try {
                const previewRes = await downloadFromAws(item.s3_preview_key);
                if (previewRes.ok) {
                  const previewBody = await previewRes.arrayBuffer();
                  await uploadToR2(item.s3_preview_key, previewBody, item.mime_type || "application/octet-stream");
                }
              } catch (e) {
                console.warn(`Preview migration failed for work ${item.id}:`, e);
              }
            }

            await adminClient
              .from("works")
              .update({ storage_provider: "r2" })
              .eq("id", item.id);

            migrated++;
          } catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message : "Unknown error";
            errors.push(`work:${item.id}: ${msg}`);
          }
        }
      }

      return new Response(JSON.stringify({
        migrated,
        failed,
        errors: errors.slice(0, 10),
        message: migrated > 0 || failed > 0
          ? `Batch complete: ${migrated} migrated, ${failed} failed`
          : "No files remaining to migrate",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'start' or 'status'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("migrate-to-r2 error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
