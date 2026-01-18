import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
// Use verified sender (onboarding@resend.dev) until custom domain is verified
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") && Deno.env.get("RESEND_FROM_EMAIL") !== "noreply@ajantaphotography.in"
  ? Deno.env.get("RESEND_FROM_EMAIL")!
  : "Ajanta Photography <onboarding@resend.dev>";
const adminEmail = Deno.env.get("BOOKING_ADMIN_EMAIL") || "";

// Default studio configuration (fallback if DB fetch fails)
const defaultStudioConfig = {
  name: "Ajanta Photography",
  phones: "+91 94435 68486, +91 76398 88486",
  email: "ajantastudiopandalur@gmail.com",
  instagram: "@ajanta.photography",
  address_line1: "GHSS School Junction, Pandalur",
  address_line2: "The Nilgiris – 643233",
  whatsapp: "+91 94435 68486",
};

interface StudioConfig {
  name: string;
  phones: string;
  email: string;
  instagram: string;
  address_line1: string;
  address_line2: string;
  whatsapp: string;
}

// Fetch studio settings from database
async function getStudioConfig(supabase: any): Promise<StudioConfig> {
  try {
    const { data, error } = await supabase
      .from("studio_settings")
      .select("setting_key, setting_value");

    if (error || !data || data.length === 0) {
      console.log("Using default studio config");
      return defaultStudioConfig;
    }

    const settingsMap: Record<string, string> = {};
    data.forEach((row: { setting_key: string; setting_value: string }) => {
      settingsMap[row.setting_key] = row.setting_value;
    });

    return {
      name: "Ajanta Photography", // Fixed identity
      phones: settingsMap.phones || defaultStudioConfig.phones,
      email: settingsMap.email || defaultStudioConfig.email,
      instagram: settingsMap.instagram || defaultStudioConfig.instagram,
      address_line1: settingsMap.address_line1 || defaultStudioConfig.address_line1,
      address_line2: `${settingsMap.address_line2 || "The Nilgiris"} – ${settingsMap.pincode || "643233"}`,
      whatsapp: settingsMap.whatsapp || defaultStudioConfig.whatsapp,
    };
  } catch (err) {
    console.error("Error fetching studio config:", err);
    return defaultStudioConfig;
  }
}

// Logo image URL (hosted externally for email compatibility)
const logoUrl = "https://storage.googleapis.com/gpt-engineer-file-uploads/ndpHLPayMuMPzXAya3Y5GR4ixrb2/uploads/1768713761500-Untitled-1-removebg-preview.png";

// Generate email header with logo image only (no text branding)
function getEmailHeader(): string {
  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${logoUrl}" alt="Ajanta Photography" style="height: 100px; width: auto; object-fit: contain;" />
    </div>
  `;
}

// Generate email footer with contact details
function getEmailFooter(config: StudioConfig): string {
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
      <div style="text-align: center; margin-bottom: 15px;">
        <img src="${logoUrl}" alt="Ajanta Photography" style="height: 60px; width: auto; object-fit: contain;" />
      </div>
      <p style="font-size: 12px; color: #a09080; margin: 0; line-height: 1.8; text-align: center;">
        ${config.address_line1}<br />
        ${config.address_line2}<br />
        Phone: ${config.phones}<br />
        Email: ${config.email}<br />
        Instagram: ${config.instagram}
      </p>
    </div>
  `;
}

interface EmailRequest {
  type: "welcome" | "gallery_ready" | "share_link" | "booking_confirmation" | "booking_admin" | "contact_confirmation" | "contact_admin" | "contact_reply" | "password_changed";
  to: string;
  data: Record<string, unknown>;
}

const getEmailContent = (type: string, data: Record<string, unknown>, config: StudioConfig, emailHeader: string, emailFooter: string) => {
  const whatsappNumber = config.whatsapp.replace(/[^0-9]/g, "");
  const primaryPhone = config.phones.split(",")[0]?.trim() || config.phones;

  switch (type) {
    case "welcome":
      return {
        subject: `Your Ajanta Photography Client Login Details`,
        text: `Hello ${data.name},\n\nYour private client account has been created with Ajanta Photography.\n\nLogin details:\nEmail: ${data.email}\nPassword: ${data.password}\n\nLogin here:\n${data.loginUrl}\n\nPlease log in and change your password after first login.\n\n– Ajanta Photography`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}

            <h2 style="color: #f5f0e8; font-weight: 300;">Hello ${data.name},</h2>
            <p style="line-height: 1.8; color: #a09080;">Your private client account has been created.</p>

            <div style="background: #252118; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
              <p style="margin: 0 0 10px 0; color: #f5f0e8; font-weight: 500;">Login details:</p>
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Email:</strong> ${data.email}</p>
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Password:</strong> <code style="background: #1a1814; padding: 4px 8px; border-radius: 4px; color: #d4a853;">${data.password}</code></p>
            </div>

            <p style="line-height: 1.8; color: #a09080; margin: 0 0 16px 0;">Login here:</p>
            <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a853, #b8923d); color: #1a1814; padding: 14px 26px; text-decoration: none; border-radius: 4px; font-weight: 600;">${data.loginUrl}</a>

            <p style="line-height: 1.8; color: #a09080; margin-top: 20px;">Please log in and change your password after first login.</p>

            ${emailFooter}
          </div>
        `,
      };

    case "gallery_ready":
      return {
        subject: `Your Gallery is Ready! - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">Great News, ${data.name}!</h2>
            <p style="line-height: 1.8; color: #a09080;">Your gallery for <strong style="color: #d4a853;">${data.albumTitle}</strong> is now ready for viewing.</p>
            <p style="line-height: 1.8; color: #a09080;">We have carefully curated and edited ${data.photoCount || "all"} photos from your special day. Each image has been crafted to preserve those precious moments.</p>
            <a href="${data.galleryUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a853, #b8923d); color: #1a1814; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: 500; margin-top: 20px;">View Your Gallery</a>
            ${emailFooter}
          </div>
        `,
      };

    case "share_link":
      return {
        subject: `Gallery Shared With You - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">A Gallery Has Been Shared With You</h2>
            <p style="line-height: 1.8; color: #a09080;">You have been given access to view <strong style="color: #d4a853;">${data.albumTitle}</strong>.</p>
            ${data.password ? `
              <div style="background: #252118; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
                <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Password:</strong> <code style="background: #1a1814; padding: 4px 8px; border-radius: 4px; color: #d4a853;">${data.password}</code></p>
              </div>
            ` : ""}
            ${data.expiresAt ? `<p style="color: #a09080;">This link expires on ${data.expiresAt}.</p>` : ""}
            <a href="${data.shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a853, #b8923d); color: #1a1814; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: 500; margin-top: 20px;">View Gallery</a>
            ${emailFooter}
          </div>
        `,
      };

    case "booking_confirmation":
      return {
        subject: `Booking Request Received - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">Thank You, ${data.name}!</h2>
            <p style="line-height: 1.8; color: #a09080;">We have received your booking request for a <strong style="color: #d4a853;">${data.eventType}</strong> on <strong style="color: #d4a853;">${data.eventDate}</strong>.</p>
            <p style="line-height: 1.8; color: #a09080;">Our team will review your request and get back to you within 24 hours to discuss your vision and confirm availability.</p>
            <div style="background: #252118; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Event Type:</strong> ${data.eventType}</p>
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Date:</strong> ${data.eventDate}</p>
              ${data.message ? `<p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Message:</strong> ${data.message}</p>` : ""}
            </div>
            <p style="line-height: 1.8; color: #a09080;">Have questions? Contact us directly:</p>
            <p style="line-height: 1.8; color: #a09080;">
              📞 <a href="tel:${primaryPhone.replace(/\s/g, "")}" style="color: #d4a853; text-decoration: none;">${primaryPhone}</a><br />
              💬 <a href="https://wa.me/${whatsappNumber}" style="color: #25D366; text-decoration: none;">WhatsApp Us</a>
            </p>
            ${emailFooter}
          </div>
        `,
      };

    case "booking_admin":
      return {
        subject: `New Booking Request: ${data.eventType} - ${data.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
            <h2 style="color: #333;">New Booking Request</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${data.name}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Phone:</strong> ${data.phone || "Not provided"}</p>
              <p><strong>Event Type:</strong> ${data.eventType}</p>
              <p><strong>Event Date:</strong> ${data.eventDate}</p>
              <p><strong>Message:</strong></p>
              <p style="background: #f9f9f9; padding: 10px; border-radius: 4px;">${data.message || "No message"}</p>
            </div>
            <p style="color: #666; font-size: 12px;">This is an automated notification from ${config.name} booking system.</p>
          </div>
        `,
      };

    case "contact_confirmation":
      return {
        subject: `Message Received - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">Thank You, ${data.name}!</h2>
            <p style="line-height: 1.8; color: #a09080;">We have received your message and will get back to you soon.</p>
            <div style="background: #252118; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
              ${data.subject ? `<p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Subject:</strong> ${data.subject}</p>` : ""}
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Your Message:</strong></p>
              <p style="margin: 5px 0; color: #a09080;">${data.message}</p>
            </div>
            <p style="line-height: 1.8; color: #a09080;">Have urgent questions? Contact us directly:</p>
            <p style="line-height: 1.8; color: #a09080;">
              📞 <a href="tel:${primaryPhone.replace(/\s/g, "")}" style="color: #d4a853; text-decoration: none;">${primaryPhone}</a><br />
              💬 <a href="https://wa.me/${whatsappNumber}" style="color: #25D366; text-decoration: none;">WhatsApp Us</a>
            </p>
            ${emailFooter}
          </div>
        `,
      };

    case "contact_admin":
      return {
        subject: `New Contact Message: ${data.subject || "General Inquiry"} - ${data.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
            <h2 style="color: #333;">New Contact Message</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${data.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
              ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ""}
              ${data.subject ? `<p><strong>Subject:</strong> ${data.subject}</p>` : ""}
              <p><strong>Message:</strong></p>
              <p style="background: #f9f9f9; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${data.message}</p>
            </div>
            <p style="color: #666; font-size: 12px;">This is an automated notification from ${config.name} contact form.</p>
          </div>
        `,
      };

    case "contact_reply":
      return {
        subject: `Re: ${data.originalSubject || "Your Message"} - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">Hello ${data.recipientName},</h2>
            <div style="line-height: 1.8; color: #a09080; white-space: pre-wrap;">${data.replyMessage}</div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
              <p style="font-size: 12px; color: #666; margin-bottom: 10px;">In response to your message:</p>
              <div style="background: #252118; padding: 15px; border-radius: 8px; border-left: 3px solid #d4a853;">
                <p style="font-size: 12px; color: #888; margin: 0; white-space: pre-wrap;">${data.originalMessage}</p>
              </div>
            </div>
            
            <p style="line-height: 1.8; color: #a09080; margin-top: 20px;">
              Have more questions? Feel free to reply to this email or contact us directly:<br />
              📞 <a href="tel:${primaryPhone.replace(/\s/g, "")}" style="color: #d4a853; text-decoration: none;">${primaryPhone}</a><br />
              💬 <a href="https://wa.me/${whatsappNumber}" style="color: #25D366; text-decoration: none;">WhatsApp Us</a>
            </p>
            ${emailFooter}
          </div>
        `,
      };

    case "password_changed":
      return {
        subject: `Password Changed - ${config.name}`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
            ${emailHeader}
            <h2 style="color: #f5f0e8; font-weight: 300;">Password Updated</h2>
            <p style="line-height: 1.8; color: #a09080;">Hello ${data.name},</p>
            <p style="line-height: 1.8; color: #a09080;">Your password has been successfully changed.</p>
            <div style="background: #252118; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #d4a853;">
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Account:</strong> ${data.email}</p>
              <p style="margin: 5px 0; color: #a09080;"><strong style="color: #f5f0e8;">Changed at:</strong> ${data.changedAt}</p>
            </div>
            <p style="line-height: 1.8; color: #a09080;">If you did not make this change, please contact us immediately:</p>
            <p style="line-height: 1.8; color: #a09080;">
              📞 <a href="tel:${primaryPhone.replace(/\s/g, "")}" style="color: #d4a853; text-decoration: none;">${primaryPhone}</a><br />
              💬 <a href="https://wa.me/${whatsappNumber}" style="color: #25D366; text-decoration: none;">WhatsApp Us</a><br />
              ✉️ <a href="mailto:${config.email}" style="color: #d4a853; text-decoration: none;">${config.email}</a>
            </p>
            ${emailFooter}
          </div>
        `,
      };

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { type, to, data }: EmailRequest = await req.json();
    
    console.log(`Sending ${type} email to ${to}`);
    
    // Fetch studio config from database
    const studioConfig = await getStudioConfig(supabase);
    const emailHeader = getEmailHeader();
    const emailFooter = getEmailFooter(studioConfig);
    
    const emailContent = getEmailContent(type, data, studioConfig, emailHeader, emailFooter);
    
    // For admin notifications, send to admin email
    const adminTypes = ["booking_admin", "contact_admin"];
    const recipient = adminTypes.includes(type) ? adminEmail : to;
    
    if (!recipient) {
      throw new Error("No recipient email provided");
    }

    const { data: emailResult, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: emailContent.subject,
      html: emailContent.html,
      text: (emailContent as any).text,
    });

    // Log the email (NEVER store passwords in logs)
    const safeData = (() => {
      const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
      if ("password" in copy) delete (copy as any).password;
      return copy;
    })();

    await supabase.from("email_logs").insert({
      to_email: recipient,
      subject: emailContent.subject,
      template_type: type,
      status: error ? "failed" : "sent",
      error_message: error?.message,
      metadata: { data: safeData, resend_id: emailResult?.id },
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, id: emailResult?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
