import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({
        success: false,
        error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY",
      });
    }

    if (!serviceRoleKey) {
      return jsonResponse({ success: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
    }

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Unauthorized" });
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
      return jsonResponse({ success: false, error: "Unauthorized" });
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
      return jsonResponse({ success: false, error: "Failed to verify admin role" });
    }

    const allowedRoles = ["admin", "owner", "editor"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      console.log("Access denied for role:", roleData?.role);
      return jsonResponse({ success: false, error: "Admin access required" });
    }

    const payload: CreateClientRequest = await req.json();

    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse({ success: false, error: "Invalid input" });
    }

    const { name, email, eventName, eventDate, notes } = parsed.data;

    // Check if user already exists
    const { data: existingUser, error: existingUserError } = await serviceSupabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingUserError) {
      console.error("Error checking existing user:", existingUserError);
      return jsonResponse({ success: false, error: "Failed to validate client email" });
    }

    if (existingUser?.user_id) {
      const existingUserId = existingUser.user_id as string;

      const { data: existingRole, error: existingRoleError } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUserId)
        .maybeSingle();

      if (existingRoleError) {
        console.error("Error checking existing user role:", existingRoleError);
        return jsonResponse({ success: false, error: "Failed to validate existing user role" });
      }

      if (existingRole?.role && existingRole.role !== "client") {
        return jsonResponse({
          success: false,
          error: "This email is already used by a staff account",
        });
      }

      const { data: existingClient, error: existingClientError } = await serviceSupabase
        .from("clients")
        .select("id")
        .eq("user_id", existingUserId)
        .maybeSingle();

      if (existingClientError) {
        console.error("Error checking existing client:", existingClientError);
        return jsonResponse({
          success: false,
          error: "Failed to validate existing client record",
        });
      }

      if (existingClient?.id) {
        return jsonResponse({
          success: false,
          error: "A client with this email already exists",
        });
      }

      console.log("Cleaning up existing client auth user without client record:", existingUserId);
      try {
        await serviceSupabase.from("profiles").delete().eq("user_id", existingUserId);
        await serviceSupabase.from("user_roles").delete().eq("user_id", existingUserId);
        await serviceSupabase.auth.admin.deleteUser(existingUserId);
      } catch (cleanupError) {
        console.error("Failed to cleanup existing user:", cleanupError);
        return jsonResponse({
          success: false,
          error: "Failed to cleanup existing user. Please try again.",
        });
      }
    }

    // Generate password
    const password = generatePassword();

    // Create auth user with metadata
    const { data: authData, error: signUpError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "client",
        must_change_password: true,
      },
    });

    if (signUpError || !authData.user) {
      console.error("Error creating user:", signUpError);
      throw signUpError || new Error("Failed to create user");
    }

    console.log("User created:", authData.user.id);

    // Create client record
    const { data: clientData, error: clientError } = await serviceSupabase
      .from("clients")
      .insert({
        user_id: authData.user.id,
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
        await serviceSupabase.from("profiles").delete().eq("user_id", authData.user.id);
        await serviceSupabase.from("user_roles").delete().eq("user_id", authData.user.id);
        await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("Rollback cleanup failed", cleanupError);
      }

      return jsonResponse({
        success: false,
        error: lastWelcomeEmailError
          ? `Welcome email failed: ${lastWelcomeEmailError}`
          : "Welcome email failed to send. Please try again.",
      });
    }

    // Create default album (optional)
    const { data: albumData, error: albumError } = await serviceSupabase
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: clientData,
        album: albumData,
        userId: authData.user.id,
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
    return jsonResponse({ success: false, error: errorMessage });
  }
};

serve(handler);
