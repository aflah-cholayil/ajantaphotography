import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateClientRequest {
  name: string;
  email: string;
  eventName: string;
  eventDate?: string;
  notes?: string;
}

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

    const { name, email, eventName, eventDate, notes }: CreateClientRequest = await req.json();

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

    // Create default album
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

    // Send welcome email with retry
    const origin = req.headers.get("origin") || "https://studio-shines-77.lovable.app";
    const loginUrl = `${origin}/login`;
    
    const sendWelcomeEmail = async (retryCount = 0): Promise<void> => {
      try {
        const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            type: "welcome",
            to: email,
            data: {
              name,
              email,
              password,
              eventName,
              loginUrl,
            },
          }),
        });
        
        if (!response.ok && retryCount < 2) {
          console.log(`Email send failed, retrying... (attempt ${retryCount + 2})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendWelcomeEmail(retryCount + 1);
        }
        
        if (response.ok) {
          console.log("Welcome email sent successfully");
        } else {
          console.error("Failed to send welcome email after retries");
        }
      } catch (emailError) {
        if (retryCount < 2) {
          console.log(`Email error, retrying... (attempt ${retryCount + 2})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return sendWelcomeEmail(retryCount + 1);
        }
        console.error("Failed to send welcome email:", emailError);
      }
    };
    
    // Send email (don't await to avoid blocking response)
    sendWelcomeEmail();

    return new Response(
      JSON.stringify({
        success: true,
        client: clientData,
        album: albumData,
        userId: authData.user.id,
        temporaryPassword: password,
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
