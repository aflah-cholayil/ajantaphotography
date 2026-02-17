import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
};

const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2BucketName = Deno.env.get("R2_BUCKET_NAME")!;

const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

function getMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    default: return "video/mp4";
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Only allow showcase video assets
    if (!key.startsWith("assets/showcase_video/")) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const objectUrl = `${r2Endpoint}/${r2BucketName}/${key}`;
    const headers: Record<string, string> = {};

    // Forward Range header for seeking support
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const r2Response = await r2.fetch(objectUrl, { method: "GET", headers });

    if (!r2Response.ok && r2Response.status !== 206) {
      console.error(`R2 fetch failed: ${r2Response.status}`);
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const contentType = getMimeType(key);
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };

    const contentLength = r2Response.headers.get("Content-Length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = r2Response.headers.get("Content-Range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    return new Response(r2Response.body, {
      status: r2Response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("video-stream error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
