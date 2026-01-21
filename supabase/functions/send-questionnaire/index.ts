import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuestionnaireRequest {
  booking_id?: string;
  bookingId?: string;
  resend?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as SendQuestionnaireRequest;
    // Accept both camelCase and snake_case
    const booking_id = body.booking_id || body.bookingId;
    const isResend = body.resend;

    if (!booking_id) {
      throw new Error("booking_id is required");
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    // Check if questionnaire already exists
    let questionnaire;
    const { data: existingQuestionnaire } = await supabase
      .from("event_questionnaires")
      .select("*")
      .eq("booking_id", booking_id)
      .single();

    if (existingQuestionnaire) {
      questionnaire = existingQuestionnaire;
      // Update status to sent if resending
      if (isResend) {
        await supabase
          .from("event_questionnaires")
          .update({ status: "sent" })
          .eq("id", existingQuestionnaire.id);
      }
    } else {
      // Create new questionnaire
      const { data: newQuestionnaire, error: createError } = await supabase
        .from("event_questionnaires")
        .insert({
          booking_id,
          event_type: booking.event_type,
          event_date: booking.event_date,
          status: "sent",
        })
        .select()
        .single();

      if (createError || !newQuestionnaire) {
        throw new Error("Failed to create questionnaire");
      }
      questionnaire = newQuestionnaire;
    }

    // Get studio settings for branding
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("setting_key, setting_value");

    const studioConfig: Record<string, string> = {};
    settings?.forEach((s: { setting_key: string; setting_value: string }) => {
      studioConfig[s.setting_key] = s.setting_value;
    });

    const studioName = studioConfig.studio_name || "Ajanta Photography";
    const studioEmail = studioConfig.studio_email || "info@ajantaphotography.com";
    const studioPhone = studioConfig.studio_phone || "";

    // Build questionnaire URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://studio-shines-77.lovable.app";
    const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaire.token}`;

    const logoUrl = "https://dtknywnttoslxthlqwsz.supabase.co/storage/v1/object/public/avatars/logo.png";

    // Format event date
    const eventDate = booking.event_date 
      ? new Date(booking.event_date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : 'To be confirmed';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Questionnaire</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #2a2a2a 0%, #1f1f1f 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #d4af37 0%, #f4e5b0 50%, #d4af37 100%); padding: 30px; text-align: center;">
              <img src="${logoUrl}" alt="${studioName}" style="height: 60px; margin-bottom: 10px;" onerror="this.style.display='none'">
              <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 2px;">${studioName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #d4af37; margin: 0 0 20px; font-size: 24px; font-weight: 300;">Hello ${booking.client_name},</h2>
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 1.8; margin: 0 0 25px;">
                Thank you for choosing us to capture your special moments. To ensure we deliver an exceptional experience tailored to your vision, please complete our event questionnaire.
              </p>
              
              <!-- Booking Summary -->
              <div style="background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="color: #d4af37; margin: 0 0 15px; font-size: 18px; font-weight: 500;">Booking Summary</h3>
                <table width="100%" style="color: #e0e0e0; font-size: 15px;">
                  <tr>
                    <td style="padding: 8px 0; color: #888;">Event Type:</td>
                    <td style="padding: 8px 0; text-align: right; color: #fff;">${booking.event_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888;">Event Date:</td>
                    <td style="padding: 8px 0; text-align: right; color: #fff;">${eventDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888;">Contact:</td>
                    <td style="padding: 8px 0; text-align: right; color: #fff;">${booking.client_email}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 1.8; margin: 0 0 30px;">
                This questionnaire helps us understand your preferences, key moments to capture, and any special requirements for your event.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${questionnaireUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4e5b0 50%, #d4af37 100%); color: #1a1a1a; text-decoration: none; padding: 18px 45px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; box-shadow: 0 8px 25px rgba(212, 175, 55, 0.3);">
                  Fill Event Questionnaire
                </a>
              </div>
              
              <p style="color: #888; font-size: 14px; text-align: center; margin: 30px 0 0;">
                This link is unique to your booking. Please do not share it with others.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #1a1a1a; padding: 30px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.2);">
              <p style="color: #888; font-size: 14px; margin: 0 0 10px;">
                ${studioName}
              </p>
              <p style="color: #666; font-size: 13px; margin: 0;">
                ${studioEmail}${studioPhone ? ` | ${studioPhone}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    // Send email using fetch
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${studioName} <${fromEmail}>`,
        to: [booking.client_email],
        subject: `Event Questionnaire - ${booking.event_type}`,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Questionnaire email sent:", emailData);

    // Log email
    await supabase.from("email_logs").insert({
      to_email: booking.client_email,
      subject: `Event Questionnaire - ${booking.event_type}`,
      template_type: "questionnaire",
      status: emailResponse.ok ? "sent" : "failed",
      metadata: { booking_id, questionnaire_id: questionnaire.id, resend_id: emailData?.id },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        questionnaire_id: questionnaire.id,
        token: questionnaire.token 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending questionnaire:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
