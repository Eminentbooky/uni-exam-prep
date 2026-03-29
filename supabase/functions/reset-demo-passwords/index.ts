import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const demoAccounts = [
    { email: "otobongamosukoyo@gmail.com", password: "demo123456" },
    { email: "blessingiribhogbe@gmail.com", password: "demo123456" },
  ];

  const results = [];

  for (const account of demoAccounts) {
    // Find user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      results.push({ email: account.email, error: listError.message });
      continue;
    }

    const user = users.find((u) => u.email === account.email);
    if (!user) {
      results.push({ email: account.email, error: "User not found" });
      continue;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: account.password,
    });

    results.push({ email: account.email, success: !error, error: error?.message });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
