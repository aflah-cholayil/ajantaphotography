import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") && Deno.env.get("RESEND_FROM_EMAIL") !== "noreply@ajantaphotography.in"
  ? Deno.env.get("RESEND_FROM_EMAIL")!
  : "Ajanta Photography <onboarding@resend.dev>";

const logoUrl = "https://storage.googleapis.com/gpt-engineer-file-uploads/ndpHLPayMuMPzXAya3Y5GR4ixrb2/uploads/1768713761500-Untitled-1-removebg-preview.png";

async function getStudioConfig(supabase: any) {
  try {
    const { data } = await supabase.from("studio_settings").select("setting_key, setting_value");
    const map: Record<string, string> = {};
    data?.forEach((r: any) => { map[r.setting_key] = r.setting_value; });
    return {
      name: "Ajanta Photography",
      phones: map.phones || "+91 94435 68486, +91 76398 88486",
      email: map.email || "ajantastudiopandalur@gmail.com",
      address_line1: map.address_line1 || "GHSS School Junction, Pandalur",
      address_line2: `${map.address_line2 || "The Nilgiris"} – ${map.pincode || "643233"}`,
    };
  } catch {
    return {
      name: "Ajanta Photography",
      phones: "+91 94435 68486, +91 76398 88486",
      email: "ajantastudiopandalur@gmail.com",
      address_line1: "GHSS School Junction, Pandalur",
      address_line2: "The Nilgiris – 643233",
    };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Sanitize HTML server-side
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

// Get effective dates with backward compat
function getEventDates(quotation: any): string[] {
  if (quotation.event_dates && quotation.event_dates.length > 0) return quotation.event_dates;
  if (quotation.event_date) return [quotation.event_date];
  return [];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { quotationId } = await req.json();
    if (!quotationId) throw new Error("quotationId is required");

    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .single();
    if (qErr || !quotation) throw new Error("Quotation not found");

    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("display_order");

    const config = await getStudioConfig(supabase);
    const siteUrl = Deno.env.get("SITE_URL") || "https://studio-shines-77.lovable.app";
    const viewUrl = `${siteUrl}/quotation/${quotation.quotation_number}`;

    const itemRows = (items || []).map((item: any, i: number) => `
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 12px 8px; color: #a09080;">${i + 1}</td>
        <td style="padding: 12px 8px; color: #f5f0e8;">${item.item_name}${item.description ? `<br/><span style="font-size: 12px; color: #a09080;">${item.description}</span>` : ''}</td>
        <td style="padding: 12px 8px; color: #a09080; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; color: #a09080; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 12px 8px; color: #f5f0e8; text-align: right;">${formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    const taxAmount = quotation.subtotal * (quotation.tax_percentage / 100);
    const eventDates = getEventDates(quotation);
    const datesDisplay = eventDates.map((d: string) => formatDate(d)).join(', ');

    // Build event details block
    const hasEventInfo = quotation.event_type || eventDates.length > 0;
    const eventBlock = hasEventInfo ? `
      <div style="background: #252118; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
        ${quotation.event_type ? `<p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Event:</strong> ${quotation.event_type}</p>` : ''}
        ${eventDates.length > 0 ? `<p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Date${eventDates.length > 1 ? 's' : ''}:</strong> ${datesDisplay}</p>` : ''}
      </div>` : '';

    // Notes block - render HTML directly, sanitized
    const notesBlock = quotation.notes ? `
      <div style="background: #252118; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #d4a853; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase;">Terms & Notes</p>
        <div style="color: #a09080; margin: 0; font-size: 13px; line-height: 1.6;">${sanitizeHtml(quotation.notes)}</div>
      </div>` : '';

    const html = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${logoUrl}" alt="Ajanta Photography" style="height: 120px; width: auto;" />
        </div>

        <h2 style="color: #f5f0e8; font-weight: 300; margin-bottom: 5px;">Quotation</h2>
        <p style="color: #d4a853; font-size: 14px; margin-top: 0;">${quotation.quotation_number}</p>

        <p style="line-height: 1.8; color: #a09080;">Dear ${quotation.client_name},</p>
        <p style="line-height: 1.8; color: #a09080;">Thank you for your interest. Please find your quotation details below:</p>

        ${eventBlock}
        ${notesBlock}

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #d4a853;">
              <th style="padding: 10px 8px; text-align: left; color: #d4a853; font-size: 12px;">#</th>
              <th style="padding: 10px 8px; text-align: left; color: #d4a853; font-size: 12px;">Item</th>
              <th style="padding: 10px 8px; text-align: center; color: #d4a853; font-size: 12px;">Qty</th>
              <th style="padding: 10px 8px; text-align: right; color: #d4a853; font-size: 12px;">Price</th>
              <th style="padding: 10px 8px; text-align: right; color: #d4a853; font-size: 12px;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="text-align: right; margin: 20px 0;">
          <p style="color: #a09080; margin: 5px 0;">Subtotal: <strong style="color: #f5f0e8;">${formatCurrency(quotation.subtotal)}</strong></p>
          ${quotation.tax_percentage > 0 ? `<p style="color: #a09080; margin: 5px 0;">Tax (${quotation.tax_percentage}%): <strong style="color: #f5f0e8;">${formatCurrency(taxAmount)}</strong></p>` : ''}
          ${quotation.discount_amount > 0 ? `<p style="color: #a09080; margin: 5px 0;">Discount: <strong style="color: #4ade80;">-${formatCurrency(quotation.discount_amount)}</strong></p>` : ''}
          <p style="color: #d4a853; font-size: 20px; margin: 15px 0 0 0; border-top: 1px solid #333; padding-top: 10px;">Total: <strong>${formatCurrency(quotation.total_amount)}</strong></p>
        </div>

        ${quotation.valid_until ? `<p style="color: #a09080; font-size: 13px;">Valid until: ${formatDate(quotation.valid_until)}</p>` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${viewUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a853, #b8923d); color: #1a1814; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-weight: 600;">View Full Quotation</a>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
          <div style="text-align: center; margin-bottom: 15px;">
            <img src="${logoUrl}" alt="Ajanta Photography" style="height: 70px; width: auto;" />
          </div>
          <p style="font-size: 12px; color: #a09080; margin: 0; line-height: 1.8; text-align: center;">
            ${config.address_line1}<br />
            ${config.address_line2}<br />
            Phone: ${config.phones}<br />
            Email: ${config.email}
          </p>
        </div>
      </div>
    `;

    const { data: emailResult, error: emailErr } = await resend.emails.send({
      from: fromEmail,
      to: [quotation.client_email],
      subject: `Quotation ${quotation.quotation_number} - Ajanta Photography`,
      html,
    });

    if (emailErr) throw new Error(emailErr.message);

    await supabase
      .from("quotations")
      .update({ status: "sent" })
      .eq("id", quotationId);

    await supabase.from("email_logs").insert({
      to_email: quotation.client_email,
      subject: `Quotation ${quotation.quotation_number} - Ajanta Photography`,
      template_type: "quotation",
      status: "sent",
      metadata: { quotation_id: quotationId, resend_id: emailResult?.id },
    });

    return new Response(JSON.stringify({ success: true, id: emailResult?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-quotation] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
