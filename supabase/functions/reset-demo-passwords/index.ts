import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const demoAccounts = [
    { email: "otobongamosukoyo@gmail.com", password: "demo123456", full_name: "Otobong Amos (Instructor)", role: "instructor" },
    { email: "blessingiribhogbe@gmail.com", password: "demo123456", full_name: "Blessing Iribhogbe (Student)", role: "student" },
  ];

  const results = [];

  for (const account of demoAccounts) {
    // Create user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name },
    });

    if (error) {
      results.push({ email: account.email, error: error.message });
      continue;
    }

    // Update profile role
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: account.role, full_name: account.full_name })
      .eq("user_id", data.user.id);

    results.push({ email: account.email, success: true, userId: data.user.id, profileUpdate: profileError?.message || "ok" });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
