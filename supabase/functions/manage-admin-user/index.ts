import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Ajanta Photography <onboarding@resend.dev>";

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

// Generate a secure random password
function generateSecurePassword(length = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = "";
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

// Get role display name
function getRoleDisplayName(role: AdminRole): string {
  const roleNames: Record<AdminRole, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };
  return roleNames[role];
}

// Send welcome email to new admin
async function sendWelcomeEmail(
  email: string,
  name: string,
  role: AdminRole,
  password: string,
  loginUrl: string
): Promise<void> {
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
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }

  console.log(`Welcome email sent to ${email}`);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if the requesting user is an owner
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can manage admin users" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const request: AdminRequest = await req.json();

    // Handle different actions
    if (request.action === "create") {
      const { name, email, role, password, autoGeneratePassword } = request;

      if (!name || !email || !role) {
        return new Response(
          JSON.stringify({ error: "Name, email, and role are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Prevent creating another owner
      if (role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot create another owner. There can only be one owner." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Generate or use provided password
      const finalPassword = autoGeneratePassword !== false 
        ? generateSecurePassword() 
        : (password || generateSecurePassword());

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create new admin user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { 
          name,
          role,
          must_change_password: true,
        }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Admin user created:", newUser.user?.id);

      // Get the login URL from the request origin or use default
      const origin = req.headers.get("origin") || "https://ajantaphotography.com";
      const loginUrl = `${origin}/login`;

      // Send welcome email
      try {
        await sendWelcomeEmail(email, name, role, finalPassword, loginUrl);
      } catch (emailError) {
        console.error("Email sending failed but user was created:", emailError);
        // User was created, but email failed - we'll return a warning
      }

      // Log the email
      await supabaseAdmin.from("email_logs").insert({
        to_email: email,
        subject: "Your Ajanta Photography Admin Access",
        template_type: "admin_welcome",
        status: "sent",
        metadata: { role, name },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Admin user created and email sent",
          user_id: newUser.user?.id 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (request.action === "update") {
      const { userId, name, role, isActive } = request;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Prevent changing to owner role
      if (role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot change role to owner" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Prevent modifying the owner
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (targetRole?.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot modify the owner account" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update profile
      const profileUpdates: Record<string, unknown> = {};
      if (name !== undefined) profileUpdates.name = name;
      if (isActive !== undefined) profileUpdates.is_active = isActive;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", userId);

        if (profileError) {
          console.error("Error updating profile:", profileError);
          return new Response(
            JSON.stringify({ error: "Failed to update profile" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Update role if specified
      if (role) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);

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
      const { userId } = request;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Prevent deleting the owner
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (targetRole?.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Cannot delete the owner account" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Delete the user (this will cascade to profiles and user_roles)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

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
