import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 10 * 60 * 1000;

async function listBucketObjects(client: AwsClient, baseListUrl: string) {
  let totalBytes = 0;
  let totalObjects = 0;
  let continuationToken: string | undefined;
  const prefixSizes: Record<string, number> = {};
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let thisMonthBytes = 0;

  const monthlyData: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyData[key] = 0;
  }

  do {
    let listUrl = `${baseListUrl}?list-type=2&max-keys=1000`;
    if (continuationToken) {
      listUrl += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    }

    const listRes = await client.fetch(listUrl);
    const xml = await listRes.text();

    const contents = xml.match(/<Contents>([\s\S]*?)<\/Contents>/g) || [];
    for (const item of contents) {
      const sizeMatch = item.match(/<Size>(\d+)<\/Size>/);
      const keyMatch = item.match(/<Key>(.*?)<\/Key>/);
      const dateMatch = item.match(/<LastModified>(.*?)<\/LastModified>/);

      if (sizeMatch && keyMatch) {
        const size = parseInt(sizeMatch[1]);
        const key = keyMatch[1];
        totalBytes += size;
        totalObjects++;

        const parts = key.split("/");
        if (parts.length >= 2) {
          const prefix = parts[0];
          prefixSizes[prefix] = (prefixSizes[prefix] || 0) + size;
        }

        if (dateMatch) {
          const objDate = new Date(dateMatch[1]);
          if (objDate >= monthStart) {
            thisMonthBytes += size;
          }
          const mKey = `${objDate.getFullYear()}-${String(objDate.getMonth() + 1).padStart(2, "0")}`;
          if (monthlyData[mKey] !== undefined) {
            monthlyData[mKey] += size;
          }
        }
      }
    }

    const truncMatch = xml.match(/<IsTruncated>(.*?)<\/IsTruncated>/);
    const isTruncated = truncMatch?.[1] === "true";
    const tokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
    continuationToken = isTruncated ? tokenMatch?.[1] : undefined;
  } while (continuationToken);

  return { totalBytes, totalObjects, prefixSizes, thisMonthBytes, monthlyData };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData || !["owner", "admin"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    if (!force) {
      const { data: cacheTimeRow } = await adminClient
        .from("studio_settings")
        .select("setting_value")
        .eq("setting_key", "storage_stats_cache_time")
        .maybeSingle();

      if (cacheTimeRow) {
        const cacheAge = Date.now() - parseInt(cacheTimeRow.setting_value);
        if (cacheAge < CACHE_TTL_MS) {
          const { data: cacheRow } = await adminClient
            .from("studio_settings")
            .select("setting_value")
            .eq("setting_key", "storage_stats_cache")
            .maybeSingle();

          if (cacheRow) {
            return new Response(cacheRow.setting_value, {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    // AWS client
    const awsRegion = Deno.env.get("AWS_REGION")!;
    const awsBucket = Deno.env.get("AWS_BUCKET_NAME")!;
    const awsClientInstance = new AwsClient({
      accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
      region: awsRegion,
      service: "s3",
    });

    // R2 client
    const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
    const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
    const r2ClientInstance = new AwsClient({
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
      region: "auto",
      service: "s3",
    });

    // List both buckets
    const [awsStats, r2Stats] = await Promise.all([
      listBucketObjects(awsClientInstance, `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/`),
      listBucketObjects(r2ClientInstance, `${r2Endpoint}/${r2Bucket}/`).catch((e) => {
        console.warn("R2 listing failed:", e.message);
        return { totalBytes: 0, totalObjects: 0, prefixSizes: {}, thisMonthBytes: 0, monthlyData: {} };
      }),
    ]);

    const totalBytes = awsStats.totalBytes + r2Stats.totalBytes;
    const totalObjects = awsStats.totalObjects + r2Stats.totalObjects;
    const thisMonthBytes = awsStats.thisMonthBytes + r2Stats.thisMonthBytes;

    // Merge prefix sizes
    const prefixSizes: Record<string, number> = { ...awsStats.prefixSizes };
    for (const [k, v] of Object.entries(r2Stats.prefixSizes)) {
      prefixSizes[k] = (prefixSizes[k] || 0) + v;
    }

    // Merge monthly data
    const monthlyData: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = (awsStats.monthlyData[key] || 0) + (r2Stats.monthlyData[key] || 0);
    }

    // Fetch DB data for per-client breakdown
    const { data: mediaData } = await adminClient.from("media").select("album_id, size, created_at");
    const { data: albumsData } = await adminClient.from("albums").select("id, client_id, title").eq("is_deleted", false);
    const { data: clientsData } = await adminClient.from("clients").select("id, user_id, event_name").eq("is_deleted", false);
    const { data: profilesData } = await adminClient.from("profiles").select("user_id, name");
    const { data: shareLinksData } = await adminClient.from("share_links").select("album_id, view_count, download_count");

    const albumToClient: Record<string, string> = {};
    const clientNames: Record<string, string> = {};
    const clientAlbumCount: Record<string, number> = {};

    const profileMap: Record<string, string> = {};
    for (const p of profilesData || []) profileMap[p.user_id] = p.name;

    for (const c of clientsData || []) {
      clientNames[c.id] = profileMap[c.user_id] || c.event_name;
      clientAlbumCount[c.id] = 0;
    }

    for (const a of albumsData || []) {
      albumToClient[a.id] = a.client_id;
      clientAlbumCount[a.client_id] = (clientAlbumCount[a.client_id] || 0) + 1;
    }

    const clientStorage: Record<string, number> = {};
    const clientDownloads: Record<string, number> = {};

    for (const m of mediaData || []) {
      const clientId = albumToClient[m.album_id];
      if (clientId) clientStorage[clientId] = (clientStorage[clientId] || 0) + (m.size || 0);
    }

    let totalDownloadCount = 0;
    for (const sl of shareLinksData || []) {
      const clientId = albumToClient[sl.album_id];
      totalDownloadCount += sl.download_count || 0;
      if (clientId) clientDownloads[clientId] = (clientDownloads[clientId] || 0) + (sl.download_count || 0);
    }

    const avgFileSize = mediaData && mediaData.length > 0
      ? mediaData.reduce((sum, m) => sum + (m.size || 0), 0) / mediaData.length
      : 5 * 1024 * 1024;

    const estimatedDownloadBytes = totalDownloadCount * avgFileSize;

    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const thisMonthGB = thisMonthBytes / (1024 * 1024 * 1024);
    const downloadGB = estimatedDownloadBytes / (1024 * 1024 * 1024);

    // R2 pricing: Storage free first 10GB then ₹1.2/GB, egress free
    const awsGB = awsStats.totalBytes / (1024 * 1024 * 1024);
    const r2GB = r2Stats.totalBytes / (1024 * 1024 * 1024);
    const awsStorageCostINR = awsGB * 1.9;
    const r2StorageCostINR = Math.max(0, r2GB - 10) * 1.2;
    const storageCostINR = awsStorageCostINR + r2StorageCostINR;
    const transferCostINR = Math.max(0, downloadGB - 100) * 7; // AWS transfer only
    const estimatedMonthlyCostINR = storageCostINR + transferCostINR;

    const clientBreakdown = Object.keys(clientNames).map((cid) => {
      const storageBytes = clientStorage[cid] || 0;
      const downloads = clientDownloads[cid] || 0;
      const clientGB = storageBytes / (1024 * 1024 * 1024);
      const clientDlGB = (downloads * avgFileSize) / (1024 * 1024 * 1024);
      const clientCost = clientGB * 1.9 + Math.max(0, clientDlGB - 100) * 7;

      return {
        clientId: cid,
        clientName: clientNames[cid],
        albumCount: clientAlbumCount[cid] || 0,
        storageBytes,
        storageGB: parseFloat(clientGB.toFixed(3)),
        downloads,
        estimatedCostINR: parseFloat(clientCost.toFixed(2)),
      };
    });

    clientBreakdown.sort((a, b) => b.storageBytes - a.storageBytes);

    const monthlyGrowth = Object.entries(monthlyData).map(([month, bytes]) => ({
      month,
      sizeGB: parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(3)),
    }));

    const result = {
      summary: {
        totalBytes,
        totalGB: parseFloat(totalGB.toFixed(3)),
        totalObjects,
        thisMonthUploadBytes: thisMonthBytes,
        thisMonthUploadGB: parseFloat(thisMonthGB.toFixed(3)),
        estimatedDownloadGB: parseFloat(downloadGB.toFixed(3)),
        totalDownloadCount,
      },
      providerBreakdown: {
        aws: {
          totalBytes: awsStats.totalBytes,
          totalGB: parseFloat(awsGB.toFixed(3)),
          totalObjects: awsStats.totalObjects,
          costINR: parseFloat(awsStorageCostINR.toFixed(2)),
        },
        r2: {
          totalBytes: r2Stats.totalBytes,
          totalGB: parseFloat(r2GB.toFixed(3)),
          totalObjects: r2Stats.totalObjects,
          costINR: parseFloat(r2StorageCostINR.toFixed(2)),
        },
      },
      costs: {
        storageCostINR: parseFloat(storageCostINR.toFixed(2)),
        transferCostINR: parseFloat(transferCostINR.toFixed(2)),
        estimatedMonthlyCostINR: parseFloat(estimatedMonthlyCostINR.toFixed(2)),
      },
      prefixSizes,
      monthlyGrowth,
      clientBreakdown,
      cachedAt: Date.now(),
    };

    const resultJson = JSON.stringify(result);

    await adminClient.from("studio_settings").upsert(
      { setting_key: "storage_stats_cache", setting_value: resultJson },
      { onConflict: "setting_key" }
    );
    await adminClient.from("studio_settings").upsert(
      { setting_key: "storage_stats_cache_time", setting_value: String(Date.now()) },
      { onConflict: "setting_key" }
    );

    return new Response(resultJson, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("storage-stats error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
