import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AWS Rekognition client (NOT S3 storage — this is a separate AWS service)
const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
const rekognitionClient = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: awsRegion,
});

// R2 for fetching images
const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
const r2Bucket = Deno.env.get("R2_BUCKET_NAME")!;
const r2Client = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  region: "auto",
  service: "s3",
});

interface FaceDetectionRequest {
  action: "detect" | "process_album" | "merge_people" | "update_person" | "get_people" | "get_person_photos";
  albumId?: string;
  mediaId?: string;
  personId?: string;
  targetPersonId?: string;
  name?: string;
  isHidden?: boolean;
}

interface RekognitionFace {
  BoundingBox: {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
  };
  Confidence: number;
  FaceId?: string;
}

async function detectFacesInImage(s3Key: string): Promise<RekognitionFace[]> {
  const endpoint = `https://rekognition.${awsRegion}.amazonaws.com`;
  
  // Always download from R2 and send as bytes to Rekognition
  const objectUrl = `${r2Endpoint}/${r2Bucket}/${s3Key}`;
  const signedReq = await r2Client.sign(objectUrl, { method: "GET", aws: { signQuery: true } });
  const imageRes = await fetch(signedReq.url);
  if (!imageRes.ok) throw new Error(`Failed to download R2 image: ${imageRes.status}`);
  const imageBytes = await imageRes.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBytes)));
  
  const body = JSON.stringify({
    Image: { Bytes: base64 },
    Attributes: ["DEFAULT"],
  });

  const request = new Request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "RekognitionService.DetectFaces",
    },
    body,
  });

  const signedRequest = await rekognitionClient.sign(request, {
    aws: { service: "rekognition" },
  });

  const response = await fetch(signedRequest);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Rekognition DetectFaces error:", errorText);
    throw new Error(`Rekognition error: ${response.status}`);
  }

  const data = await response.json();
  return data.FaceDetails || [];
}

async function processAlbumFaces(albumId: string) {
  console.log(`[Background] Starting face detection for album: ${albumId}`);
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    await supabase
      .from("albums")
      .update({ 
        face_processing_status: "processing",
        face_processing_started_at: new Date().toISOString()
      })
      .eq("id", albumId);

    const { data: mediaItems, error: mediaError } = await supabase
      .from("media")
      .select("id, s3_key, s3_preview_key")
      .eq("album_id", albumId)
      .eq("type", "photo");

    if (mediaError) throw new Error(mediaError.message);

    console.log(`[Background] Found ${mediaItems?.length || 0} photos to process`);

    const facesDetected: any[] = [];
    let personCounter = 1;
    const createdPeople: { id: string; referenceFace: any }[] = [];

    for (const item of mediaItems || []) {
      try {
        const s3Key = item.s3_preview_key || item.s3_key;
        console.log(`[Background] Processing image: ${s3Key}`);

        const faces = await detectFacesInImage(s3Key);
        console.log(`[Background] Detected ${faces.length} faces in ${item.id}`);

        for (const face of faces) {
          if (face.Confidence < 90) continue;

          const faceData = {
            media_id: item.id,
            album_id: albumId,
            bounding_box: face.BoundingBox,
            confidence: face.Confidence,
            person_id: null as string | null,
          };

          let matchedPersonId: string | null = null;

          for (const existingPerson of createdPeople) {
            const refFace = existingPerson.referenceFace;
            const sizeDiff = Math.abs(refFace.bounding_box.Width - face.BoundingBox.Width);
            const heightDiff = Math.abs(refFace.bounding_box.Height - face.BoundingBox.Height);
            
            if (sizeDiff < 0.08 && heightDiff < 0.08) {
              matchedPersonId = existingPerson.id;
              break;
            }
          }

          if (!matchedPersonId) {
            const { data: newPerson, error: personError } = await supabase
              .from("people")
              .insert({
                album_id: albumId,
                name: `Person ${personCounter}`,
                face_thumbnail_key: null,
                photo_count: 1,
              })
              .select()
              .single();

            if (personError) continue;

            matchedPersonId = newPerson.id;
            createdPeople.push({ id: newPerson.id, referenceFace: { bounding_box: face.BoundingBox } });
            personCounter++;
          }

          faceData.person_id = matchedPersonId;
          facesDetected.push(faceData);
        }
      } catch (err) {
        console.error(`[Background] Error processing ${item.id}:`, err);
      }
    }

    if (facesDetected.length > 0) {
      const { error: insertError } = await supabase
        .from("detected_faces")
        .insert(facesDetected);
      
      if (insertError) console.error("[Background] Error inserting faces:", insertError);
    }

    for (const person of createdPeople) {
      const { count } = await supabase
        .from("detected_faces")
        .select("*", { count: "exact", head: true })
        .eq("person_id", person.id);

      await supabase
        .from("people")
        .update({ photo_count: count || 0 })
        .eq("id", person.id);
    }

    await supabase
      .from("albums")
      .update({ 
        face_processing_status: "completed",
        face_processing_completed_at: new Date().toISOString()
      })
      .eq("id", albumId);

    console.log(`[Background] Face detection complete. Created ${createdPeople.length} people from ${facesDetected.length} faces.`);
  } catch (error) {
    console.error("[Background] Error in processAlbumFaces:", error);
    
    await supabase
      .from("albums")
      .update({ face_processing_status: "failed" })
      .eq("id", albumId);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: FaceDetectionRequest = await req.json();
    const { action, albumId, personId, targetPersonId, name, isHidden } = body;

    if (action === "process_album" && albumId && req.headers.get("x-internal-trigger") === "album-ready") {
      const globalThis_ = globalThis as any;
      if (typeof globalThis_.EdgeRuntime !== "undefined" && globalThis_.EdgeRuntime.waitUntil) {
        globalThis_.EdgeRuntime.waitUntil(processAlbumFaces(albumId));
      } else {
        await processAlbumFaces(albumId);
      }
      
      return new Response(JSON.stringify({ success: true, message: "Face processing started in background" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: claimsData.claims.sub as string };

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roleData?.role && ["admin", "owner", "editor"].includes(roleData.role);
    const isClient = roleData?.role === "client";

    if (isClient && albumId) {
      const { data: album } = await supabase
        .from("albums")
        .select("client_id, clients!inner(user_id)")
        .eq("id", albumId)
        .single();

      if (!album || (album as any).clients?.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "get_people") {
      if (!albumId) {
        return new Response(JSON.stringify({ error: "albumId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: albumData } = await supabase
        .from("albums")
        .select("face_processing_status")
        .eq("id", albumId)
        .single();

      const query = supabase
        .from("people")
        .select("*")
        .eq("album_id", albumId)
        .order("photo_count", { ascending: false });

      if (isClient) query.eq("is_hidden", false);

      const { data: people, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        people, 
        processingStatus: albumData?.face_processing_status || "pending" 
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_person_photos") {
      if (!personId) {
        return new Response(JSON.stringify({ error: "personId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: faces, error } = await supabase
        .from("detected_faces")
        .select("media_id, media!inner(id, file_name, s3_key, s3_preview_key, type, width, height)")
        .eq("person_id", personId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mediaMap = new Map();
      for (const face of faces || []) {
        if ((face as any).media) mediaMap.set((face as any).media.id, (face as any).media);
      }

      return new Response(JSON.stringify({ media: Array.from(mediaMap.values()) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process_album") {
      if (!albumId) {
        return new Response(JSON.stringify({ error: "albumId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("detected_faces").delete().eq("album_id", albumId);
      await supabase.from("people").delete().eq("album_id", albumId);
      
      const globalThis_ = globalThis as any;
      if (typeof globalThis_.EdgeRuntime !== "undefined" && globalThis_.EdgeRuntime.waitUntil) {
        globalThis_.EdgeRuntime.waitUntil(processAlbumFaces(albumId));
        
        return new Response(JSON.stringify({ success: true, message: "Face processing started in background" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await processAlbumFaces(albumId);
        
        return new Response(JSON.stringify({ success: true, message: "Face processing completed" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update_person") {
      if (!personId) {
        return new Response(JSON.stringify({ error: "personId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (isHidden !== undefined) updates.is_hidden = isHidden;

      const { error } = await supabase.from("people").update(updates).eq("id", personId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "merge_people") {
      if (!personId || !targetPersonId) {
        return new Response(JSON.stringify({ error: "personId and targetPersonId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("detected_faces")
        .update({ person_id: targetPersonId })
        .eq("person_id", personId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count } = await supabase
        .from("detected_faces")
        .select("*", { count: "exact", head: true })
        .eq("person_id", targetPersonId);

      await supabase.from("people").update({ photo_count: count || 0 }).eq("id", targetPersonId);
      await supabase.from("people").delete().eq("id", personId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in face-detection function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
