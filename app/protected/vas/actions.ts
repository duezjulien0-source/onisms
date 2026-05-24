"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true; message?: string } | { error: string };

async function assertAdmin(): Promise<{ ok: true } | ActionResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.claims.sub)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Accès admin requis" };
  }
  return { ok: true };
}

export async function inviteVA(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin();
  if ("error" in guard) return guard;

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const budget = Number(formData.get("budget") || 0);

  if (!email || !email.includes("@")) {
    return { error: "Email invalide" };
  }
  if (budget < 0) {
    return { error: "Budget négatif interdit" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error) {
    return { error: `Échec de l'invitation : ${error.message}` };
  }

  // Petit délai pour laisser le trigger creer le profil
  await new Promise((r) => setTimeout(r, 300));

  if (data.user && budget > 0) {
    await admin
      .from("profiles")
      .update({ budget_total: budget })
      .eq("id", data.user.id);
  }

  revalidatePath("/protected/vas");
  revalidatePath("/protected");
  return { success: true, message: `Invitation envoyée à ${email}` };
}

export async function updateVABudget(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin();
  if ("error" in guard) return guard;

  const vaId = String(formData.get("vaId") || "");
  const budget = Number(formData.get("budget") || 0);

  if (!vaId) return { error: "VA introuvable" };
  if (budget < 0) return { error: "Budget négatif interdit" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ budget_total: budget, updated_at: new Date().toISOString() })
    .eq("id", vaId);

  if (error) return { error: error.message };

  revalidatePath("/protected/vas");
  return { success: true, message: "Budget mis à jour" };
}

export async function toggleVAStatus(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin();
  if ("error" in guard) return guard;

  const vaId = String(formData.get("vaId") || "");
  const currentStatus = String(formData.get("currentStatus") || "active");
  const newStatus = currentStatus === "active" ? "suspended" : "active";

  if (!vaId) return { error: "VA introuvable" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", vaId);

  if (error) return { error: error.message };

  revalidatePath("/protected/vas");
  return { success: true };
}

export async function deleteVA(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin();
  if ("error" in guard) return guard;

  const vaId = String(formData.get("vaId") || "");
  if (!vaId) return { error: "VA introuvable" };

  const admin = createAdminClient();
  // Supprime l'utilisateur de auth.users → cascade sur profiles
  const { error } = await admin.auth.admin.deleteUser(vaId);
  if (error) return { error: error.message };

  revalidatePath("/protected/vas");
  return { success: true };
}

export async function rechargeWallet(formData: FormData): Promise<ActionResult> {
  const amount = Number(formData.get("amount") || 0);
  if (amount <= 0) return { error: "Montant invalide" };

  // Utilise la fonction SQL securisee (verifie admin cote DB, atomique)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recharge_wallet", { amount });

  if (error) return { error: error.message };
  if (!data) return { error: "Accès admin requis ou montant invalide" };

  revalidatePath("/protected");
  revalidatePath("/protected/vas");
  return { success: true, message: `Wallet rechargé de $${amount.toFixed(2)}` };
}
