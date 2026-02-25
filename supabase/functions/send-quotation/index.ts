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
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; color: #666;">${i + 1}</td>
        <td style="padding: 12px 8px; color: #333;">${item.item_name}${item.description ? `<br/><span style="font-size: 12px; color: #666;">${item.description}</span>` : ''}</td>
        <td style="padding: 12px 8px; color: #666; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; color: #666; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 12px 8px; color: #333; text-align: right;">${formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    const taxAmount = quotation.subtotal * (quotation.tax_percentage / 100);
    const eventDates = getEventDates(quotation);
    const datesDisplay = eventDates.map((d: string) => formatDate(d)).join(', ');

    // Build event details block
    const hasEventInfo = quotation.event_type || eventDates.length > 0;
    const eventBlock = hasEventInfo ? `
      <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37;">
        ${quotation.event_type ? `<p style="margin: 5px 0; color: #555;"><strong style="color: #333;">Event:</strong> ${quotation.event_type}</p>` : ''}
        ${eventDates.length > 0 ? `<p style="margin: 5px 0; color: #555;"><strong style="color: #333;">Date${eventDates.length > 1 ? 's' : ''}:</strong> ${datesDisplay}</p>` : ''}
      </div>` : '';

    // Notes block - render HTML directly, sanitized
    const styledNotes = quotation.notes ? sanitizeHtml(quotation.notes)
      // Headings — merge existing style (preserves text-align) then handle bare tags
      .replace(/<h1 style="([^"]*)"/gi, (_m: string, s: string) => `<h1 style="${s}; font-size:26px; color:#222; margin:20px 0 10px; font-weight:700;"`)
      .replace(/<h1>/gi, '<h1 style="font-size:26px; color:#222; margin:20px 0 10px; font-weight:700;">')
      .replace(/<h2 style="([^"]*)"/gi, (_m: string, s: string) => `<h2 style="${s}; font-size:22px; color:#222; margin:18px 0 8px; font-weight:700;"`)
      .replace(/<h2>/gi, '<h2 style="font-size:22px; color:#222; margin:18px 0 8px; font-weight:700;">')
      .replace(/<h3 style="([^"]*)"/gi, (_m: string, s: string) => `<h3 style="${s}; font-size:18px; color:#222; margin:15px 0 6px; font-weight:600;"`)
      .replace(/<h3>/gi, '<h3 style="font-size:18px; color:#222; margin:15px 0 6px; font-weight:600;">')
      .replace(/<h4 style="([^"]*)"/gi, (_m: string, s: string) => `<h4 style="${s}; font-size:15px; color:#222; margin:12px 0 4px; font-weight:600;"`)
      .replace(/<h4>/gi, '<h4 style="font-size:15px; color:#222; margin:12px 0 4px; font-weight:600;">')
      // Paragraphs — merge existing style (preserves text-align)
      .replace(/<p style="([^"]*)"/gi, (_m: string, s: string) => `<p style="${s}; margin:8px 0; color:#444; line-height:1.6;"`)
      .replace(/<p>/gi, '<p style="margin:8px 0; color:#444; line-height:1.6;">')
      // Inline formatting
      .replace(/<strong>/gi, '<strong style="color:#222; font-weight:600;">')
      .replace(/<b>/gi, '<b style="color:#222; font-weight:600;">')
      .replace(/<em>/gi, '<em style="color:#444;">')
      .replace(/<u>/gi, '<u style="color:#444;">')
      // Lists
      .replace(/<ul>/gi, '<ul style="list-style-type:disc; padding-left:20px; margin:8px 0;">')
      .replace(/<ol>/gi, '<ol style="list-style-type:decimal; padding-left:20px; margin:8px 0;">')
      .replace(/<li>/gi, '<li style="margin:4px 0; color:#444;">')
      // Media & separators
      .replace(/<img /gi, '<img style="max-width:100%; height:auto; border-radius:6px; margin:10px 0;" ')
      .replace(/<hr\s*\/?>/gi, '<hr style="border:none; border-top:1px solid #eee; margin:15px 0;">')
      : '';

    const notesBlock = quotation.notes ? `
      <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #d4af37; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: 600;">Terms & Notes</p>
        <div style="color: #444; margin: 0; line-height: 1.7;">${styledNotes}</div>
      </div>` : '';

    const html = `
      <body style="margin: 0; padding: 0; background: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="650" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 10px; padding: 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); font-family: Arial, Helvetica, sans-serif;">
                <tr>
                  <td style="text-align: center; padding-bottom: 25px;">
                    <img src="${logoUrl}" alt="Ajanta Photography" style="height: 140px; width: auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 25px;">
                    <h2 style="margin: 0; color: #222; font-weight: 300; font-size: 24px;">Quotation</h2>
                    <p style="margin: 5px 0 0; color: #d4af37; font-size: 14px;">${quotation.quotation_number}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="line-height: 1.8; color: #555; margin: 0 0 8px 0;">Dear ${quotation.client_name},</p>
                    <p style="line-height: 1.8; color: #555; margin: 0;">Thank you for your interest. Please find your quotation details below:</p>
                  </td>
                </tr>
                <tr><td>${eventBlock}</td></tr>
                <tr><td>${notesBlock}</td></tr>
                <tr>
                  <td>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                      <thead>
                        <tr style="border-bottom: 2px solid #d4af37;">
                          <th style="padding: 10px 8px; text-align: left; color: #d4af37; font-size: 12px; text-transform: uppercase;">#</th>
                          <th style="padding: 10px 8px; text-align: left; color: #d4af37; font-size: 12px; text-transform: uppercase;">Item</th>
                          <th style="padding: 10px 8px; text-align: center; color: #d4af37; font-size: 12px; text-transform: uppercase;">Qty</th>
                          <th style="padding: 10px 8px; text-align: right; color: #d4af37; font-size: 12px; text-transform: uppercase;">Price</th>
                          <th style="padding: 10px 8px; text-align: right; color: #d4af37; font-size: 12px; text-transform: uppercase;">Total</th>
                        </tr>
                      </thead>
                      <tbody>${itemRows}</tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: right; padding: 20px 0;">
                    <p style="color: #555; margin: 5px 0;">Subtotal: <strong style="color: #222;">${formatCurrency(quotation.subtotal)}</strong></p>
                    ${quotation.tax_percentage > 0 ? `<p style="color: #555; margin: 5px 0;">Tax (${quotation.tax_percentage}%): <strong style="color: #222;">${formatCurrency(taxAmount)}</strong></p>` : ''}
                    ${quotation.discount_amount > 0 ? `<p style="color: #555; margin: 5px 0;">Discount: <strong style="color: #16a34a;">-${formatCurrency(quotation.discount_amount)}</strong></p>` : ''}
                    <p style="color: #d4af37; font-size: 20px; margin: 15px 0 0 0; border-top: 1px solid #eee; padding-top: 10px;">Total: <strong>${formatCurrency(quotation.total_amount)}</strong></p>
                  </td>
                </tr>
                ${quotation.valid_until ? `<tr><td><p style="color: #999; font-size: 13px;">Valid until: ${formatDate(quotation.valid_until)}</p></td></tr>` : ''}
                <tr>
                  <td style="text-align: center; padding: 30px 0;">
                    <a href="${viewUrl}" style="display: inline-block; background: #d4af37; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">View Full Quotation</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 30px; border-top: 1px solid #eee;">
                    <div style="text-align: center; margin-bottom: 15px;">
                      <img src="${logoUrl}" alt="Ajanta Photography" style="height: 90px; width: auto;" />
                    </div>
                    <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.8; text-align: center;">
                      ${config.address_line1}<br />
                      ${config.address_line2}<br />
                      Phone: ${config.phones}<br />
                      Email: ${config.email}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
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
