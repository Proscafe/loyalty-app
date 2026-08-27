export type UserRole = "master_admin" | "staff" | "supervisor" | "client";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_number: string | null;
  role: UserRole;
  client_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientStamp {
  id: string;
  client_id: string;
  category_id: string;
  stamp_count: number;
  updated_at: string;
}

export type RewardStatus = "available" | "claimed" | "redeemed" | "expired";

export interface Reward {
  id: string;
  client_id: string;
  category_id: string;
  reward_type: string;
  status: RewardStatus;
  earned_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

export type TransactionAction =
  | "add_stamp"
  | "reward_earned"
  | "reward_redeemed"
  | "manual_adjustment";

export interface StampTransaction {
  id: string;
  client_id: string;
  category_id: string | null;
  staff_id: string | null;
  action_type: TransactionAction;
  stamp_count_before: number | null;
  stamp_count_after: number | null;
  reward_id: string | null;
  notes: string | null;
  created_at: string;
}

/** Result returned by the `add_stamp` RPC */
export interface AddStampResult {
  success: boolean;
  new_stamp_count: number;
  reward_earned: boolean;
  reward?: {
    id: string;
    reward_type: string;
    category_id: string;
    category_name: string;
    status: RewardStatus;
    earned_at: string;
  };
}
