import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function extractClientCode(rawCode: string) {
  const trimmed = rawCode.trim();

  try {
    const url = new URL(trimmed);

    const fromQuery =
      url.searchParams.get("client_code") ||
      url.searchParams.get("code") ||
      url.searchParams.get("client");

    if (fromQuery) return fromQuery.trim().replace(/^#/, "");

    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart) return lastPart.trim().replace(/^#/, "");
  } catch {
    // Not a URL.
  }

  return trimmed.replace(/^#/, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get("code");

    if (!rawCode) {
      return NextResponse.json(
        { error: "Missing client code." },
        { status: 400 }
      );
    }

    const clientCode = extractClientCode(rawCode);

    const supabase = createServiceClient();

    const { data: client, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, id_number, role, client_code")
      .eq("role", "client")
      .ilike("client_code", clientCode)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!client) {
      return NextResponse.json(
        {
          error: "Client not found for scanned code.",
          scanned_code: clientCode,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected scan error.",
      },
      { status: 500 }
    );
  }
}