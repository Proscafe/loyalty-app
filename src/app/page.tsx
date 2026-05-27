import { redirect } from "next/navigation";
import { getCurrentProfile, homeForRole } from "@/lib/auth";

// Reads auth cookies — must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  redirect(homeForRole(profile.role));
}
