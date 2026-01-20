import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HashRequest {
  password: string;
}

interface VerifyRequest {
  password: string;
  hash: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "hash";
    const body = await req.json();

    if (action === "hash") {
      const { password }: HashRequest = body;
      
      if (!password || typeof password !== "string") {
        return new Response(
          JSON.stringify({ error: "Password is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (password.length < 4 || password.length > 72) {
        return new Response(
          JSON.stringify({ error: "Password must be between 4 and 72 characters" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Generate bcrypt hash with cost factor of 10
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      
      console.log("Password hashed successfully");

      return new Response(
        JSON.stringify({ hash }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else if (action === "verify") {
      const { password, hash }: VerifyRequest = body;
      
      if (!password || !hash) {
        return new Response(
          JSON.stringify({ error: "Password and hash are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Verify password against hash
      const isValid = bcrypt.compareSync(password, hash);
      
      console.log("Password verification:", isValid ? "valid" : "invalid");

      return new Response(
        JSON.stringify({ valid: isValid }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'hash' or 'verify'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: unknown) {
    console.error("Error in hash-password function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
