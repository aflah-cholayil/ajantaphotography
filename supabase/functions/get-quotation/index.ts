import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { quotation_number } = await req.json();
    if (!quotation_number) throw new Error("quotation_number is required");

    const { data: quotation, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("quotation_number", quotation_number)
      .single();

    if (error || !quotation) throw new Error("Quotation not found");

    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotation.id)
      .order("display_order");

    // Fetch studio settings for public view
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("setting_key, setting_value");

    const studioConfig: Record<string, string> = {};
    settings?.forEach((r: any) => { studioConfig[r.setting_key] = r.setting_value; });

    // Update status to viewed if sent
    if (quotation.status === "sent") {
      await supabase
        .from("quotations")
        .update({ status: "viewed" })
        .eq("id", quotation.id);
      quotation.status = "viewed";
    }

    return new Response(JSON.stringify({ quotation, items: items || [], studioConfig }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
