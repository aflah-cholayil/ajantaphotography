import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, action',
};

const awsRegion = Deno.env.get('AWS_REGION') || 'ap-south-1';
const bucketName = Deno.env.get('AWS_BUCKET_NAME') || '';

const aws = new AwsClient({
  accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
  region: awsRegion,
  service: 's3',
});

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
  console.log('manage-work function called:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc('is_admin_user', { _user_id: user.id });

    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    // Get action from query param or header
    const action = url.searchParams.get('action') || req.headers.get('action');
    console.log('Action:', action);

    // Handle different actions
    if (action === 'upload-url') {
      // Generate presigned URL for upload using aws4fetch
      const { fileName, contentType, fileSize } = await req.json() as UploadRequest;
      console.log('Upload request:', { fileName, contentType, fileSize });
      
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `works/${timestamp}_${sanitizedFileName}`;
      const previewKey = `works/previews/${timestamp}_${sanitizedFileName}`;

      // Generate presigned PUT URL for main file
      const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
      const signedReq = await aws.sign(objectUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        aws: {
          signQuery: true,
        },
      });
      const uploadUrl = signedReq.url;

      // Generate presigned PUT URL for preview
      const previewObjectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${previewKey}`;
      const previewSignedReq = await aws.sign(previewObjectUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        aws: {
          signQuery: true,
        },
      });
      const previewUploadUrl = previewSignedReq.url;

      console.log('Generated upload URLs for work:', s3Key);

      return new Response(JSON.stringify({
        uploadUrl,
        previewUploadUrl,
        s3Key,
        previewKey,
        bucket: bucketName,
        region: awsRegion,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      // Create work record
      const workData = await req.json() as WorkData;
      console.log('Creating work:', workData.title);
      
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
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating work:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Work created:', data.id);
      return new Response(JSON.stringify({ work: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const workId = url.searchParams.get('id');
      if (!workId) {
        return new Response(JSON.stringify({ error: 'Work ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updates = await req.json();
      console.log('Updating work:', workId, updates);
      
      const { data, error } = await serviceClient
        .from('works')
        .update(updates)
        .eq('id', workId)
        .select()
        .single();

      if (error) {
        console.error('Error updating work:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Work updated:', workId);
      return new Response(JSON.stringify({ work: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const workId = url.searchParams.get('id');
      if (!workId) {
        return new Response(JSON.stringify({ error: 'Work ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get work to get S3 keys
      const { data: work, error: fetchError } = await serviceClient
        .from('works')
        .select('s3_key, s3_preview_key')
        .eq('id', workId)
        .single();

      if (fetchError || !work) {
        console.error('Work not found:', workId);
        return new Response(JSON.stringify({ error: 'Work not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete from S3 using aws4fetch
      try {
        const deleteUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${work.s3_key}`;
        const deleteReq = await aws.sign(deleteUrl, { method: 'DELETE' });
        await fetch(deleteReq.url, { method: 'DELETE', headers: deleteReq.headers });
        console.log('Deleted S3 object:', work.s3_key);

        if (work.s3_preview_key) {
          const previewDeleteUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${work.s3_preview_key}`;
          const previewDeleteReq = await aws.sign(previewDeleteUrl, { method: 'DELETE' });
          await fetch(previewDeleteReq.url, { method: 'DELETE', headers: previewDeleteReq.headers });
          console.log('Deleted S3 preview:', work.s3_preview_key);
        }
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
        // Continue with DB delete even if S3 fails
      }

      // Delete from database
      const { error: deleteError } = await serviceClient
        .from('works')
        .delete()
        .eq('id', workId);

      if (deleteError) {
        console.error('Error deleting work:', deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Work deleted:', workId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'signed-url') {
      // Generate signed URL for viewing
      const s3Key = url.searchParams.get('key');
      if (!s3Key) {
        return new Response(JSON.stringify({ error: 'S3 key required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const objectUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
      const signedReq = await aws.sign(objectUrl, {
        method: 'GET',
        aws: {
          signQuery: true,
        },
      });

      console.log('Generated signed URL for:', s3Key);
      return new Response(JSON.stringify({ url: signedReq.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('Invalid action:', action);
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manage-work:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(handler);
