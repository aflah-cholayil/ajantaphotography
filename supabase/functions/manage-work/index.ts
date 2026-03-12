import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, action, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const cacheHeaders = {
  'Cache-Control': 'public, max-age=3500',
};

const r2Endpoint = Deno.env.get('R2_ENDPOINT')!;
const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  region: 'auto',
  service: 's3',
});

const baseUrl = `${r2Endpoint}/${r2Bucket}`;

interface WorkData {
  title: string;
  description?: string;
  category: string;
  type: string;
  s3_key: string;
  s3_preview_key?: string;
  width?: number;
  height?: number;
  size: number;
  mime_type: string;
  show_on_home?: boolean;
  show_on_gallery?: boolean;
  status?: string;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc('is_admin_user', { _user_id: user.id });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || req.headers.get('action');

    // ── Upload URL (single PUT for files < 50MB) ──
    if (action === 'upload-url') {
      const { fileName, contentType, fileSize } = await req.json();
      
      if (fileSize > 5 * 1024 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File size exceeds 5GB limit' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `${timestamp}_${sanitizedFileName}`;
      const previewKey = s3Key;

      // Sign only host header per R2 constraint
      const objectUrl = `${baseUrl}/${s3Key}`;
      const signedReq = await r2Client.sign(objectUrl, {
        method: 'PUT',
        headers: { host: new URL(objectUrl).host },
        aws: { signQuery: true },
      });

      return new Response(JSON.stringify({
        uploadUrl: signedReq.url,
        s3Key,
        previewKey,
        bucket: r2Bucket,
        region: 'auto',
        storageProvider: 'r2',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Multipart: Initiate ──
    if (action === 'multipart-initiate') {
      const { fileName, contentType } = await req.json();
      
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `${timestamp}_${sanitizedFileName}`;
      const previewKey = s3Key;

      const initiateUrl = `${baseUrl}/${s3Key}?uploads`;
      const signedReq = await r2Client.sign(initiateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
      });

      const response = await fetch(signedReq.url, {
        method: 'POST',
        headers: signedReq.headers,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Multipart initiate failed:', text);
        return new Response(JSON.stringify({ error: 'Failed to initiate multipart upload' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const xml = await response.text();
      const uploadIdMatch = xml.match(/<UploadId>(.+?)<\/UploadId>/);
      const uploadId = uploadIdMatch?.[1];

      if (!uploadId) {
        return new Response(JSON.stringify({ error: 'Failed to get upload ID' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ uploadId, s3Key, previewKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Multipart: Get Part URL ──
    if (action === 'multipart-part-url') {
      const { s3Key, uploadId, partNumber } = await req.json();
      
      const partUrl = `${baseUrl}/${s3Key}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
      const signedReq = await r2Client.sign(partUrl, {
        method: 'PUT',
        headers: { host: new URL(partUrl).host },
        aws: { signQuery: true },
      });

      return new Response(JSON.stringify({ url: signedReq.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Multipart: Complete ──
    if (action === 'multipart-complete') {
      const { s3Key, uploadId, parts } = await req.json();
      
      let xmlParts = '<CompleteMultipartUpload>';
      for (const part of parts) {
        xmlParts += `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`;
      }
      xmlParts += '</CompleteMultipartUpload>';

      const completeUrl = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;
      const signedReq = await r2Client.sign(completeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlParts,
      });

      const response = await fetch(signedReq.url, {
        method: 'POST',
        headers: signedReq.headers,
        body: xmlParts,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Multipart complete failed:', text);
        return new Response(JSON.stringify({ error: 'Failed to complete multipart upload' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Multipart: Abort ──
    if (action === 'multipart-abort') {
      const { s3Key, uploadId } = await req.json();
      
      const abortUrl = `${baseUrl}/${s3Key}?uploadId=${encodeURIComponent(uploadId)}`;
      const signedReq = await r2Client.sign(abortUrl, { method: 'DELETE' });
      await fetch(signedReq.url, { method: 'DELETE', headers: signedReq.headers });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Create work record ──
    if (action === 'create') {
      const workData = await req.json() as WorkData;
      
      const { data, error } = await serviceClient
        .from('works')
        .insert({
          title: workData.title,
          description: workData.description,
          category: workData.category,
          type: workData.type,
          s3_key: workData.s3_key,
          s3_preview_key: workData.s3_preview_key,
          width: workData.width,
          height: workData.height,
          size: workData.size,
          mime_type: workData.mime_type,
          show_on_home: workData.show_on_home ?? false,
          show_on_gallery: workData.show_on_gallery ?? true,
          status: workData.status ?? 'active',
          storage_provider: 'r2',
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ work: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Update work ──
    if (action === 'update') {
      const workId = url.searchParams.get('id');
      if (!workId) {
        return new Response(JSON.stringify({ error: 'Work ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updates = await req.json();
      
      const { data, error } = await serviceClient
        .from('works')
        .update(updates)
        .eq('id', workId)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ work: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Delete work ──
    if (action === 'delete') {
      const workId = url.searchParams.get('id');
      if (!workId) {
        return new Response(JSON.stringify({ error: 'Work ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: work, error: fetchError } = await serviceClient
        .from('works')
        .select('s3_key, s3_preview_key')
        .eq('id', workId)
        .single();

      if (fetchError || !work) {
        return new Response(JSON.stringify({ error: 'Work not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const deleteUrl = `${baseUrl}/${work.s3_key}`;
        const deleteReq = await r2Client.sign(deleteUrl, { method: 'DELETE' });
        await fetch(deleteReq.url, { method: 'DELETE', headers: deleteReq.headers });

        if (work.s3_preview_key && work.s3_preview_key !== work.s3_key) {
          const previewDeleteUrl = `${baseUrl}/${work.s3_preview_key}`;
          const previewDeleteReq = await r2Client.sign(previewDeleteUrl, { method: 'DELETE' });
          await fetch(previewDeleteReq.url, { method: 'DELETE', headers: previewDeleteReq.headers });
        }
      } catch (s3Error) {
        console.error('Storage delete error:', s3Error);
      }

      const { error: deleteError } = await serviceClient
        .from('works')
        .delete()
        .eq('id', workId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Signed URL (with cache headers) ──
    if (action === 'signed-url') {
      const s3Key = url.searchParams.get('key');
      if (!s3Key) {
        return new Response(JSON.stringify({ error: 'S3 key required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const objectUrl = `${baseUrl}/${s3Key}`;
      const signedReq = await r2Client.sign(objectUrl, {
        method: 'GET',
        aws: { signQuery: true },
      });

      return new Response(JSON.stringify({ url: signedReq.url }), {
        headers: { ...corsHeaders, ...cacheHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manage-work:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(handler);
