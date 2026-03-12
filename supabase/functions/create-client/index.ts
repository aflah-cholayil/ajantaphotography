import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const CREATE_CLIENT_BUILD = "20260310-01";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

interface CreateClientRequest {
  name: string;
  email: string;
  eventName: string;
  eventDate?: string | null;
  notes?: string | null;
}

const createClientSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  eventName: z.string().trim().min(2).max(200),
  eventDate: z.string().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});


// Generate a secure random password
const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
};

const findAuthUserByEmail = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<{ id: string; email?: string } | null> => {
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
      throw new Error(`Auth list users failed (${res.status}): ${text}`);
    }

    const json = await res.json().catch(() => null) as any;
    const users = (json?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const match = users.find((u) => (u.email || "").trim().toLowerCase() === normalizedEmail);
    if (match) return { id: match.id, email: match.email ?? undefined };
    if (users.length < perPage) return null;
  }

  return null;
};

const getAuthUserByEmail = async (
  serviceSupabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<{ id: string; email?: string } | null> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await serviceSupabase.rpc("get_auth_user_id_by_email", {
      p_email: normalizedEmail,
    });
    if (!error && data) return { id: data as string, email: normalizedEmail };
  } catch {
    // ignore
  }

  return await findAuthUserByEmail(supabaseUrl, serviceRoleKey, normalizedEmail);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({
        success: false,
        error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY",
      }, 500);
    }

    if (!serviceRoleKey) {
      return jsonResponse({ success: false, error: "Missing SERVICE_ROLE_KEY" }, 500);
    }

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceSupabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const userId = claims.claims.sub as string;

    // Check if user is admin
    const { data: roleData, error: roleError } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return jsonResponse({ success: false, error: "Failed to verify admin role" }, 500);
    }

    const allowedRoles = ["admin", "owner", "editor"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      console.log("Access denied for role:", roleData?.role);
      return jsonResponse({ success: false, error: "Admin access required" }, 403);
    }

    const payload: CreateClientRequest = await req.json();

    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const issuePath = firstIssue?.path?.length ? firstIssue.path.join(".") : "request";
      const issueMessage = firstIssue?.message || "Invalid input";
      return jsonResponse({ success: false, error: `${issuePath}: ${issueMessage}` }, 400);
    }

    const { name, email, eventName, eventDate, notes } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingProfile, error: existingProfileError } = await serviceSupabase
      .from("profiles")
      .select("user_id")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingProfileError) {
      console.error("Error checking existing profile:", existingProfileError);
      return jsonResponse({ success: false, error: "Failed to validate client email" }, 500);
    }

    let clientUserId: string | null = (existingProfile?.user_id as string | undefined) ?? null;
    let authUserWasCreated = false;
    let existingClientId: string | null = null;
    if (!clientUserId) {
      try {
        const existingAuthUser = await getAuthUserByEmail(
          serviceSupabase,
          supabaseUrl,
          serviceRoleKey,
          normalizedEmail
        );
        clientUserId = existingAuthUser?.id ?? null;
      } catch (listUsersError) {
        console.error("Failed to list auth users:", listUsersError);
      }
    }

    const password = generatePassword();

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (clientUserId) {
        const { data: existingRoles, error: existingRolesError } = await serviceSupabase
          .from("user_roles")
          .select("role")
          .eq("user_id", clientUserId);

        if (existingRolesError) {
          console.error("Error checking existing user roles:", existingRolesError);
          return jsonResponse({ success: false, error: "Failed to validate existing user role" }, 500);
        }

        const roles = (existingRoles ?? []).map((r: any) => r.role).filter(Boolean) as string[];
        const staffRoles = ["owner", "admin", "editor", "viewer"];
        if (roles.some((r) => staffRoles.includes(r))) {
          return jsonResponse({ success: false, error: "This email is already used by a staff account" }, 409);
        }

        const { data: existingClient, error: existingClientError } = await serviceSupabase
          .from("clients")
          .select("id")
          .eq("user_id", clientUserId)
          .limit(1)
          .maybeSingle();

        if (existingClientError) {
          console.error("Error checking existing client:", existingClientError);
          return jsonResponse({ success: false, error: "Failed to validate existing client record" }, 500);
        }

        existingClientId = (existingClient?.id as string | undefined) ?? null;

        const { error: updateUserError } = await serviceSupabase.auth.admin.updateUserById(clientUserId, {
          password,
          user_metadata: {
            name,
            role: "client",
            must_change_password: true,
          },
        });

        if (updateUserError) {
          console.error("Error updating existing user:", updateUserError);
          return jsonResponse({ success: false, error: updateUserError.message }, 500);
        }

        const { error: profileUpsertError } = await serviceSupabase
          .from("profiles")
          .upsert(
            { user_id: clientUserId, name, email: normalizedEmail, must_change_password: true, is_active: true },
            { onConflict: "user_id" }
          );

        if (profileUpsertError) {
          console.error("Error upserting profile:", profileUpsertError);
          return jsonResponse({ success: false, error: "Failed to update profile" }, 500);
        }

        await serviceSupabase.from("user_roles").delete().eq("user_id", clientUserId);
        const { error: roleInsertError } = await serviceSupabase
          .from("user_roles")
          .insert({ user_id: clientUserId, role: "client" });

        if (roleInsertError) {
          console.error("Error inserting client role:", roleInsertError);
          return jsonResponse({ success: false, error: "Failed to update user role" }, 500);
        }

        break;
      }

      const { data: authData, error: signUpError } = await serviceSupabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: "client",
          must_change_password: true,
        },
      });

      if (signUpError || !authData.user) {
        const message = signUpError?.message || "Failed to create user";
        const messageLower = message.toLowerCase();
        console.error("Error creating user:", signUpError);

        if (
          messageLower.includes("already exists") ||
          messageLower.includes("already registered") ||
          messageLower.includes("user already registered")
        ) {
          try {
            const existingAuthUser = await getAuthUserByEmail(
              serviceSupabase,
              supabaseUrl,
              serviceRoleKey,
              normalizedEmail
            );
            if (existingAuthUser?.id) {
              clientUserId = existingAuthUser.id;
              continue;
            }
          } catch (authLookupError) {
            console.error("Auth user lookup failed after create-user conflict:", authLookupError);
          }

          return jsonResponse(
            { success: false, error: `A user with this email already exists [${CREATE_CLIENT_BUILD}]` },
            409
          );
        }

        return jsonResponse({ success: false, error: message }, 400);
      }

      clientUserId = authData.user.id;
      authUserWasCreated = true;
      break;
    }

    if (!clientUserId) {
      return jsonResponse({ success: false, error: "Failed to resolve client user account" }, 500);
    }

    // Create or update client record
    const { data: clientData, error: clientError } = existingClientId
      ? await serviceSupabase
          .from("clients")
          .update({
            event_name: eventName,
            event_date: eventDate,
            notes,
          })
          .eq("id", existingClientId)
          .select()
          .single()
      : await serviceSupabase
          .from("clients")
          .insert({
            user_id: clientUserId,
            event_name: eventName,
            event_date: eventDate,
            notes,
          })
          .select()
          .single();

    if (clientError) {
      console.error("Error creating client:", clientError);
      throw clientError;
    }

    console.log("Client created:", clientData.id);

    // Send welcome email (MANDATORY) - retry once and fail the flow if it cannot be sent
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const baseUrl = origin || (referer ? new URL(referer).origin : Deno.env.get("SITE_URL") || "https://ajantaphotography.in");
    // Include email in URL for pre-fill
    const loginUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}`;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let lastWelcomeEmailError: string | null = null;

    const sendWelcomeEmail = async (): Promise<string | null> => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { data: emailData, error: emailError } = await serviceSupabase.functions.invoke(
          "send-email",
          {
            body: {
              type: "welcome",
              to: email,
              data: {
                name,
                email,
                password,
                loginUrl,
                clientId: clientData.id,
              },
            },
          }
        );

        if (emailError) {
          lastWelcomeEmailError = emailError.message;
          console.error("Welcome email failed", { to: email, attempt, message: emailError.message });
          if (attempt < 2) await sleep(1000);
          continue;
        }

        if ((emailData as any)?.success) {
          console.log("Welcome email sent successfully", { to: email, id: (emailData as any)?.id });
          return (emailData as any)?.id ?? null;
        }

        const returnedError =
          (emailData as any)?.error ||
          "Welcome email failed to send. Please verify email settings and try again.";
        lastWelcomeEmailError = returnedError;
        console.error("Welcome email failed", { to: email, attempt, returnedError });
        if (attempt < 2) await sleep(1000);
      }

      return null;
    };

    const emailId = await sendWelcomeEmail();

    if (!emailId) {
      // Best-effort cleanup so admin can retry creation safely
      console.error("Welcome email failed after retry. Rolling back client creation.");
      try {
        await serviceSupabase.from("clients").delete().eq("id", clientData.id);
        if (authUserWasCreated) {
          await serviceSupabase.from("profiles").delete().eq("user_id", clientUserId);
          await serviceSupabase.from("user_roles").delete().eq("user_id", clientUserId);
          await serviceSupabase.auth.admin.deleteUser(clientUserId);
        }
      } catch (cleanupError) {
        console.error("Rollback cleanup failed", cleanupError);
      }

      return jsonResponse({
        success: false,
        error: lastWelcomeEmailError
          ? `Welcome email failed: ${lastWelcomeEmailError}`
          : "Welcome email failed to send. Please try again.",
      }, 502);
    }

    // Create default album (optional)
    let albumData: unknown = null;
    if (!existingClientId) {
      const { data: createdAlbum, error: albumError } = await serviceSupabase
        .from("albums")
        .insert({
          client_id: clientData.id,
          title: eventName,
          status: "pending",
        })
        .select()
        .single();

      if (albumError) {
        console.error("Error creating album:", albumError);
      } else {
        albumData = createdAlbum;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: clientData,
        album: albumData,
        userId: clientUserId,
        temporaryPassword: password,
        emailSent: true,
        emailId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in create-client function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
};

serve(handler);
