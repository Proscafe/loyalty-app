"use client";

import dynamic from "next/dynamic";
import type { Profile, Reward, StampTransaction } from "@/types";

interface Metrics {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
}

interface Props {
  profile: Profile;
  users?: Profile[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
}

const AdminDashboardNoSsr = dynamic(
  () => import("./AdminDashboard").then((module) => module.AdminDashboard),
  {
    ssr: false,
    loading: () => (
      <main
        className="min-h-screen bg-[#798673]"
        style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}
      />
    ),
  },
);

export function AdminDashboardClient(props: Props) {
  return <AdminDashboardNoSsr {...props} />;
}
