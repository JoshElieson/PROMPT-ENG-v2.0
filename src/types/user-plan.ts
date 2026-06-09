/** Billing tier assigned to a signed-in account. */
export type UserPlan = "free" | "premium";

export const USER_PLAN_LABELS: Record<UserPlan, string> = {
  free: "Free",
  premium: "Premium",
};
