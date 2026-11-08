import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SantaChristmasGamePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="fixed inset-0 z-[100] overflow-hidden bg-[#105b64]" style={{ width: "100vw", height: "100dvh" }}>
      <style>{`
        .christmas-game-back {
          background: radial-gradient(ellipse at 35% 10%, #197a57 0%, #086341 55%, #063b31 100%);
          box-shadow: inset 0 2px 0 rgba(255,247,190,.5), inset 0 -3px 5px rgba(5,46,39,.45), 0 3px 0 #8c5328, 0 6px 12px rgba(8,43,61,.38);
          transition: transform 150ms ease, filter 150ms ease;
        }
        .christmas-game-back:hover { filter: brightness(1.1); }
        .christmas-game-back:active { transform: translateY(2px); }
        .christmas-game-back {
          position: fixed;
          top: 12px;
          left: 12px;
          width: 40px;
          height: 40px;
          box-sizing: border-box;
        }

      `}</style>
      <iframe
        title="Santa's Helper Christmas game"
        src="/christmas/santa-game/index.html"
        className="absolute inset-0 block h-full w-full border-0"
        style={{ width: "100%", height: "100%" }}
      />

      <Link
        href="/dashboard-preview/christmas"
        aria-label="Back to Christmas"
        title="Back to Christmas"
        className="christmas-game-back absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-[#f1cf65] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd66b]"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
    </main>
  );
}
