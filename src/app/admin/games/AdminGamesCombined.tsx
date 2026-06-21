"use client";

import type { Profile } from "@/types";
import { GamesPage } from "./GamesPage";

type PredictionMatchRow = Record<string, unknown>;

export function AdminGamesCombined({
  profile,
  initialMatches,
}: {
  profile: Profile;
  initialMatches: PredictionMatchRow[];
}) {
  return <GamesPage profile={profile} initialMatches={initialMatches} />;
}
