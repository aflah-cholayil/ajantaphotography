import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeEndpoint(endpoint: string) {
  const noProtocol = endpoint.replace(/^https?:\/\//i, "");
  return `https://${noProtocol.replace(/\/+$/, "")}`;
}

function bucketBaseUrl(endpoint: string, bucket: string) {
  const normalized = normalizeEndpoint(endpoint);
  if (normalized.endsWith(`/${bucket}`)) return normalized;
  return `${normalized}/${bucket}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r2EndpointRaw = Deno.env.get("R2_ENDPOINT") || "";
    const r2Bucket = Deno.env.get("R2_BUCKET_NAME") || "";
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") || "";
    const r2Secret = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";

    const envReport = {
      hasR2Endpoint: !!r2EndpointRaw,
      hasR2Bucket: !!r2Bucket,
      hasR2AccessKeyId: !!r2AccessKeyId,
      hasR2SecretAccessKey: !!r2Secret,
    };

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [{ count: mediaCount }, { count: mediaPreviewCount }, { count: mediaMediumCount }, { count: worksCount }] =
      await Promise.all([
        supabase.from("media").select("id", { count: "exact", head: true }).not("s3_key", "is", null),
        supabase.from("media").select("id", { count: "exact", head: true }).not("s3_preview_key", "is", null),
        supabase.from("media").select("id", { count: "exact", head: true }).not("s3_medium_key", "is", null),
        supabase.from("works").select("id", { count: "exact", head: true }).not("s3_key", "is", null),
      ]);

    if (!envReport.hasR2Endpoint || !envReport.hasR2Bucket || !envReport.hasR2AccessKeyId || !envReport.hasR2SecretAccessKey) {
      return new Response(
        JSON.stringify({
          project: new URL(supabaseUrl).host,
          timestamp: new Date().toISOString(),
          env: envReport,
          db: {
            mediaS3KeyRows: mediaCount ?? 0,
            mediaPreviewKeyRows: mediaPreviewCount ?? 0,
            mediaMediumKeyRows: mediaMediumCount ?? 0,
            worksS3KeyRows: worksCount ?? 0,
          },
          r2: {
            ok: false,
            error: "Missing required R2 environment variables",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const client = new AwsClient({
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2Secret,
      region: "auto",
      service: "s3",
    });

    const listUrl = `${bucketBaseUrl(r2EndpointRaw, r2Bucket)}?list-type=2&max-keys=20`;
    const signed = await client.sign(listUrl, {
      method: "GET",
      headers: { host: new URL(listUrl).host },
      aws: { signQuery: true },
    });

    const listRes = await fetch(signed.url, {
      method: "GET",
      headers: signed.headers,
    });

    const body = await listRes.text();
    const listedKeys = [...body.matchAll(/<Key>(.*?)<\/Key>/g)].map((m) => m[1]).slice(0, 10);
    const keyCountInSample = listedKeys.length;

    return new Response(
      JSON.stringify({
        project: new URL(supabaseUrl).host,
        timestamp: new Date().toISOString(),
        env: envReport,
        db: {
          mediaS3KeyRows: mediaCount ?? 0,
          mediaPreviewKeyRows: mediaPreviewCount ?? 0,
          mediaMediumKeyRows: mediaMediumCount ?? 0,
          worksS3KeyRows: worksCount ?? 0,
        },
        r2: {
          ok: listRes.ok,
          endpointHost: new URL(normalizeEndpoint(r2EndpointRaw)).host,
          bucket: r2Bucket,
          listStatus: listRes.status,
          sampleKeyCount: keyCountInSample,
          sampleKeys: listedKeys,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
