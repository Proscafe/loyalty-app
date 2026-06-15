import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId, email, password } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY on the server." },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let authUserId = userId;

    const directUpdate = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password },
    );

    if (!directUpdate.error) {
      return NextResponse.json({ ok: true });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const possibleAuthId =
      profile?.auth_user_id ??
      profile?.user_id ??
      profile?.auth_id ??
      profile?.uid ??
      null;

    if (possibleAuthId && possibleAuthId !== userId) {
      authUserId = String(possibleAuthId);
      const profileUpdate = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password },
      );
      if (!profileUpdate.error) {
        return NextResponse.json({ ok: true });
      }
    }

    const targetEmail = String(email ?? profile?.email ?? "").toLowerCase();
    if (targetEmail) {
      for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) break;
        const found = data.users.find(
          (user) => String(user.email ?? "").toLowerCase() === targetEmail,
        );
        if (found?.id) {
          const emailUpdate = await supabaseAdmin.auth.admin.updateUserById(
            found.id,
            { password },
          );
          if (!emailUpdate.error) {
            return NextResponse.json({ ok: true });
          }
          return NextResponse.json(
            { error: emailUpdate.error.message },
            { status: 500 },
          );
        }
        if (data.users.length < 1000) break;
      }
    }

    return NextResponse.json(
      {
        error:
          directUpdate.error.message ||
          "Could not find the matching auth user for this profile.",
      },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 },
    );
  }
}
