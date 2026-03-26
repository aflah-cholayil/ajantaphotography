import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AdminRole = "owner" | "admin" | "editor" | "viewer";

interface CreateAdminRequest {
  action: "create";
  name: string;
  email: string;
  role: AdminRole;
  password?: string;
  autoGeneratePassword?: boolean;
}

interface UpdateAdminRequest {
  action: "update";
  userId: string;
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
}

interface DeleteAdminRequest {
  action: "delete";
  userId: string;
}

type AdminRequest = CreateAdminRequest | UpdateAdminRequest | DeleteAdminRequest;

function generateSecurePassword(length = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + special;

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split("").sort(() => Math.random() - 0.5).join("");
}

function getRoleDisplayName(role: AdminRole): string {
  const roleNames: Record<AdminRole, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };
  return roleNames[role];
}

/** Paginated lookup — listUsers() without paging misses users beyond the first page. */
async function findAuthUserByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<{ id: string; email?: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 50; page++) {
    const url = new URL(`${supabaseUrl}/auth/v1/admin/users`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Auth list users failed:", res.status, text);
      throw new Error(`Auth list users failed (${res.status})`);
    }

    const json = (await res.json().catch(() => null)) as { users?: Array<{ id: string; email?: string | null }> };
    const users = json?.users ?? [];
    const match = users.find((u) => (u.email || "").trim().toLowerCase() === normalizedEmail);
    if (match) return { id: match.id, email: match.email ?? undefined };
    if (users.length < perPage) return null;
  }

  return null;
}

async function resolveUserIdFromJwt(
  supabaseAnonClient: ReturnType<typeof createClient>,
  serviceClient: ReturnType<typeof createClient>,
  token: string
): Promise<string | null> {
  const authAny = supabaseAnonClient.auth as unknown as {
    getClaims?: (jwt: string) => Promise<{ data?: { claims?: { sub?: string } }; error?: Error | null }>;
  };
  if (typeof authAny.getClaims === "function") {
    try {
      const { data, error } = await authAny.getClaims(token);
      if (!error && data?.claims?.sub) return data.claims.sub;
    } catch (e) {
      console.warn("getClaims failed, falling back to getUser:", e);
    }
  }
  const { data: userData, error: userErr } = await serviceClient.auth.getUser(token);
  if (!userErr && userData?.user?.id) return userData.user.id;
  return null;
}

async function sendWelcomeEmail(
  email: string,
  name: string,
  role: AdminRole,
  password: string,
  loginUrl: string
): Promise<{ ok: boolean; detail?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !apiKey.trim()) {
    console.error("RESEND_API_KEY is not set; welcome email skipped");
    return { ok: false, detail: "RESEND_API_KEY not configured on Edge Function secrets" };
  }

  const resend = new Resend(apiKey);
  const fromEmail =
    Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Ajanta Photography <onboarding@resend.dev>";

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1a1814; color: #f5f0e8; padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 32px; font-weight: 300; color: #d4a853; margin: 0;">Ajanta</h1>
        <p style="font-size: 10px; letter-spacing: 4px; color: #d4a853; margin: 5px 0;">PHOTOGRAPHY</p>
      </div>
      
      <h2 style="color: #f5f0e8; font-weight: 300;">Hello ${name},</h2>
      
      <p style="line-height: 1.8; color: #a09080;">
        You have been added as an <strong style="color: #d4a853;">${getRoleDisplayName(role)}</strong> 
        for Ajanta Photography admin panel.
      </p>
      
      <div style="background: #252118; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 3px solid #d4a853;">
        <p style="margin: 0 0 15px 0; color: #f5f0e8; font-weight: 500;">Your Login Credentials:</p>
        <p style="margin: 8px 0; color: #a09080;">
          <strong style="color: #f5f0e8;">Email:</strong> ${email}
        </p>
        <p style="margin: 8px 0; color: #a09080;">
          <strong style="color: #f5f0e8;">Password:</strong> 
          <code style="background: #1a1814; padding: 4px 8px; border-radius: 4px; color: #d4a853; font-size: 14px;">${password}</code>
        </p>
      </div>
      
      <p style="line-height: 1.8; color: #a09080;">
        <strong style="color: #f5f0e8;">⚠️ Important:</strong> Please log in and change your password immediately for security.
      </p>
      
      <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a853, #b8923d); color: #1a1814; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: 500; margin-top: 20px;">
        Access Admin Panel
      </a>
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
        <p style="font-size: 12px; color: #666;">
          This email was sent by Ajanta Photography admin system.<br>
          If you did not expect this email, please contact your administrator.
        </p>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [email],
    subject: "Your Ajanta Photography Admin Access",
    html,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    return { ok: false, detail: error.message };
  }

  console.log(`Welcome email sent to ${email}`);
  return { ok: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");

    const userId = await resolveUserIdFromJwt(supabaseUser, serviceSupabase, token);

    if (!userId) {
      console.error("manage-admin-user: could not resolve user from JWT");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleData } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can manage admin users" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const request: AdminRequest = await req.json();

    if (request.action === "create") {
      const { name, email, role, password, autoGeneratePassword } = request;

      if (!name || !email || !role) {
        return new Response(
          JSON.stringify({ error: "Name, email, and role are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot create another owner. There can only be one owner." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const finalPassword =
        autoGeneratePassword !== false ? generateSecurePassword() : (password || generateSecurePassword());

      const normalizedEmail = email.trim().toLowerCase();

      let existingUser: { id: string; email?: string } | null = null;
      try {
        existingUser = await findAuthUserByEmail(supabaseUrl, serviceRoleKey, normalizedEmail);
      } catch (e) {
        console.error("findAuthUserByEmail:", e);
        return new Response(
          JSON.stringify({ error: "Failed to check if user already exists" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: newUser, error: createError } = await serviceSupabase.auth.admin.createUser({
        email: normalizedEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          must_change_password: true,
        },
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError?.message || "Failed to create user" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const newUserId = newUser.user.id;

      const { error: profileErr } = await serviceSupabase
        .from("profiles")
        .update({
          name,
          email: normalizedEmail,
          must_change_password: true,
          is_active: true,
        })
        .eq("user_id", newUserId);

      if (profileErr) {
        console.error("Profile update after create:", profileErr);
      }

      const { error: roleUpdateErr } = await serviceSupabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", newUserId);

      if (roleUpdateErr) {
        console.error("user_roles update after create:", roleUpdateErr);
        const { error: roleInsertErr } = await serviceSupabase.from("user_roles").insert({
          user_id: newUserId,
          role,
        });
        if (roleInsertErr) {
          console.error("user_roles insert fallback:", roleInsertErr);
        }
      }

      const origin =
        req.headers.get("origin") ||
        (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null) ||
        Deno.env.get("SITE_URL") ||
        "https://ajantaphotography.in";
      const loginUrl = `${origin.replace(/\/$/, "")}/login`;

      let emailSent = false;
      let emailDetail: string | undefined;
      try {
        const sendResult = await sendWelcomeEmail(normalizedEmail, name, role, finalPassword, loginUrl);
        emailSent = sendResult.ok;
        emailDetail = sendResult.detail;
      } catch (emailErr) {
        console.error("Welcome email exception:", emailErr);
        emailDetail = emailErr instanceof Error ? emailErr.message : String(emailErr);
      }

      const { error: logErr } = await serviceSupabase.from("email_logs").insert({
        to_email: normalizedEmail,
        subject: "Your Ajanta Photography Admin Access",
        template_type: "admin_welcome",
        status: emailSent ? "sent" : "failed",
        metadata: { role, name, email_detail: emailDetail },
      });
      if (logErr) console.error("email_logs insert:", logErr);

      return new Response(
        JSON.stringify({
          success: true,
          message: emailSent
            ? "Admin user created and email sent"
            : "Admin user created but email could not be sent",
          user_id: newUserId,
          email_sent: emailSent,
          ...(emailDetail && !emailSent ? { email_warning: emailDetail } : {}),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (request.action === "update") {
      const { userId: targetUserId, name, role, isActive } = request;

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot change role to owner" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: targetRole } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .single();

      if (targetRole?.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot modify the owner account" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const profileUpdates: Record<string, unknown> = {};
      if (name !== undefined) profileUpdates.name = name;
      if (isActive !== undefined) profileUpdates.is_active = isActive;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await serviceSupabase
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", targetUserId);

        if (profileError) {
          console.error("Error updating profile:", profileError);
          return new Response(
            JSON.stringify({ error: "Failed to update profile" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      if (role) {
        const { error: roleError } = await serviceSupabase
          .from("user_roles")
          .update({ role })
          .eq("user_id", targetUserId);

        if (roleError) {
          console.error("Error updating role:", roleError);
          return new Response(
            JSON.stringify({ error: "Failed to update role" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Admin user updated" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (request.action === "delete") {
      const { userId: targetUserId } = request;

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: targetRole } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .single();

      if (targetRole?.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot delete the owner account" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        console.error("Error deleting user:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete user" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Admin user deleted" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in manage-admin-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
