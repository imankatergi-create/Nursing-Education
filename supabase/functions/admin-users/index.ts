import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  try {
    const body = await req.json()
    const { action } = body

    // ── Invite user ────────────────────────────────────────────────────────
    if (action === "invite") {
      const { email, full_name, role, employee_id, job_title, dept_id } = body

      if (!email || !full_name || !role) {
        return json({ error: "email, full_name, and role are required" }, 400)
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name, role },
        })

      if (authError) return json({ error: authError.message }, 400)

      await supabaseAdmin.from("profiles").upsert(
        {
          id: authData.user.id,
          email,
          full_name,
          role,
          employee_id: employee_id || null,
          job_title: job_title || null,
          dept_id: dept_id || null,
          account_status: "Active",
        },
        { onConflict: "id" }
      )

      // Send password setup link
      await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email })

      return json({ success: true, user_id: authData.user.id })
    }

    // ── Delete user ────────────────────────────────────────────────────────
    if (action === "delete") {
      const { user_id } = body
      if (!user_id) return json({ error: "user_id required" }, 400)

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message }, 400)

      return json({ success: true })
    }

    // ── Reset password (admin sends reset email) ────────────────────────────
    if (action === "reset_password") {
      const { email } = body
      if (!email) return json({ error: "email required" }, 400)

      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      })
      if (error) return json({ error: error.message }, 400)

      return json({ success: true })
    }

    // ── Change password (user changes own password) ────────────────────────
    if (action === "change_password") {
      const { user_id, new_password } = body
      if (!user_id || !new_password) {
        return json({ error: "user_id and new_password required" }, 400)
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      })
      if (error) return json({ error: error.message }, 400)

      return json({ success: true })
    }

    return json({ error: "Unknown action" }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
