import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claims.claims.sub as string;

    // Check if user is admin
    const { data: roleData } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const allowedRoles = ["admin", "owner", "editor"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      console.log("Access denied for role:", roleData?.role);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: CreateClientRequest = await req.json();

    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { name, email, eventName, eventDate, notes } = parsed.data;

    // Check if user already exists
    const { data: existingUser } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "A user with this email already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
    const baseUrl = origin || (referer ? new URL(referer).origin : "https://studio-shines-77.lovable.app");
    // Include email in URL for pre-fill
    const loginUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}`;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

        if (!emailError) {
          console.log("Welcome email sent successfully", { to: email, id: (emailData as any)?.id });
          return (emailData as any)?.id ?? null;
        }

        console.error("Welcome email failed", { to: email, attempt, message: emailError.message });
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

      return new Response(
        JSON.stringify({ error: "Welcome email failed to send. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
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
