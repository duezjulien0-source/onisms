import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "va";
  status: "active" | "suspended";
  budget_total: number;
  budget_spent: number;
  tags: string[];
  country: string;
  created_at: string;
  updated_at: string;
};

export type AgencyWallet = {
  id: number;
  balance: number;
  total_recharged: number;
  updated_at: string;
};

export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims?.sub) {
    redirect("/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.claims.sub)
    .single();

  if (error || !profile) {
    redirect("/auth/login");
  }

  return {
    ...profile,
    budget_total: Number(profile.budget_total),
    budget_spent: Number(profile.budget_spent),
  } as Profile;
}

export async function getAgencyWallet(): Promise<AgencyWallet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_wallet")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    balance: Number(data.balance),
    total_recharged: Number(data.total_recharged),
  } as AgencyWallet;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") {
    redirect("/protected");
  }
  return profile;
}
