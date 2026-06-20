"use client";

import dynamic from "next/dynamic";
import type { Profile, Reward, StampTransaction } from "@/types";

type AdminUser = Profile & {
  is_active?: boolean | null;
};

interface Metrics {
  totalClients: number;
  stampsIssued: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  mostActiveCategoryName: string;
}

interface Props {
  profile: Profile;
  users?: AdminUser[];
  recentTxns?: StampTransaction[];
  recentRewards?: Reward[];
  metrics: Metrics;
  initialTab?: string;
}

const AdminDashboardNoSsr = dynamic(
  () =>
    import("./AdminDashboard").then((mod) => {
      return mod.AdminDashboard ?? mod.default;
    }),
  { ssr: false },
);

export function AdminDashboardClient(props: Props) {
  return <AdminDashboardNoSsr {...props} />;
}
