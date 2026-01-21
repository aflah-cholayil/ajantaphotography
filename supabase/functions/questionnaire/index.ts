import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionnaireData {
  event_type?: string;
  event_date?: string;
  venue_name?: string;
  venue_location?: string;
  event_start_time?: string;
  event_end_time?: string;
  photography_required?: boolean;
  videography_required?: boolean;
  drone_coverage?: boolean;
  number_of_days?: number;
  photography_style?: string[];
  reference_links?: string[];
  must_capture_moments?: string;
  primary_contact_names?: string;
  important_family_members?: string;
  vip_focus_list?: string;
  album_required?: boolean;
  video_types?: string[];
  expected_delivery_timeline?: string;
  venue_rules?: string;
  cultural_notes?: string;
  additional_instructions?: string;
  confirmed?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("Token is required");
    }

    // GET - Fetch questionnaire by token
    if (req.method === "GET") {
      const { data: questionnaire, error } = await supabase
        .from("event_questionnaires")
        .select(`
          *,
          bookings (
            client_name,
            client_email,
            event_type,
            event_date,
            phone,
            message
          )
        `)
        .eq("token", token)
        .single();

      if (error || !questionnaire) {
        return new Response(
          JSON.stringify({ error: "Questionnaire not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if locked
      if (questionnaire.is_locked) {
        return new Response(
          JSON.stringify({ 
            error: "This questionnaire has been locked by the admin",
            locked: true,
            data: questionnaire 
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if already completed and not editable
      if (questionnaire.status === "completed" && !questionnaire.is_editable) {
        return new Response(
          JSON.stringify({ 
            error: "This questionnaire has already been submitted and cannot be edited",
            completed: true,
            data: questionnaire 
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: questionnaire }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // POST - Update questionnaire
    if (req.method === "POST") {
      const body = await req.json() as QuestionnaireData;

      // Verify token exists and questionnaire is not locked
      const { data: existing, error: fetchError } = await supabase
        .from("event_questionnaires")
        .select("id, is_locked, is_editable, status")
        .eq("token", token)
        .single();

      if (fetchError || !existing) {
        return new Response(
          JSON.stringify({ error: "Questionnaire not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (existing.is_locked) {
        return new Response(
          JSON.stringify({ error: "This questionnaire has been locked and cannot be modified" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (existing.status === "completed" && !existing.is_editable) {
        return new Response(
          JSON.stringify({ error: "This questionnaire has already been submitted" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update questionnaire
      const updateData: Record<string, unknown> = { ...body };
      
      // If confirmed, mark as completed
      if (body.confirmed) {
        updateData.status = "completed";
        updateData.submitted_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await supabase
        .from("event_questionnaires")
        .update(updateData)
        .eq("token", token)
        .select()
        .single();

      if (updateError) {
        throw new Error("Failed to update questionnaire");
      }

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Questionnaire error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
