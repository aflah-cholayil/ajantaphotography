import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, action',
};

// R2 only
const r2Endpoint = Deno.env.get('R2_ENDPOINT')!;
const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  region: 'auto',
  service: 's3',
});

const baseUrl = `${r2Endpoint}/${r2Bucket}`;

interface UploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
}

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

    if (action === 'upload-url') {
      const { fileName, contentType } = await req.json() as UploadRequest;
      
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `works/${timestamp}_${sanitizedFileName}`;
      const previewKey = `works/previews/${timestamp}_${sanitizedFileName}`;

      const objectUrl = `${baseUrl}/${s3Key}`;
      const signedReq = await r2Client.sign(objectUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        aws: { signQuery: true },
      });

      const previewObjectUrl = `${baseUrl}/${previewKey}`;
      const previewSignedReq = await r2Client.sign(previewObjectUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        aws: { signQuery: true },
      });

      return new Response(JSON.stringify({
        uploadUrl: signedReq.url,
        previewUploadUrl: previewSignedReq.url,
        s3Key,
        previewKey,
        bucket: r2Bucket,
        region: 'auto',
        storageProvider: 'r2',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

        if (work.s3_preview_key) {
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
