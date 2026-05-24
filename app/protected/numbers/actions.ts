"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getAvailableProviders,
  getProvider,
  PROVIDER_LABELS,
  type ProviderName,
} from "@/lib/sms-providers";
import type { Country, Service } from "@/lib/sms-providers/types";
import { getProviderScore } from "@/lib/scoring";
import { revalidatePath } from "next/cache";

type ActionResult<T = unknown> =
  | { success: true; data?: T; message?: string }
  | { error: string };

// Cout par defaut si le provider ne retourne pas de prix (ex: protocole SMS-Activate)
const DEFAULT_COST_USD = 0.5;

async function getAuthUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? { id: data.claims.sub as string } : null;
}

/** Tente de debiter le VA. Retourne true si OK, false si budget insuffisant. */
async function chargeVA(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("try_charge_va", {
    va_id_param: userId,
    amount,
  });
  if (error) {
    console.error("try_charge_va error:", error);
    return false;
  }
  return Boolean(data);
}

async function refundVA(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const supabase = await createClient();
  await supabase.rpc("refund_va", { va_id_param: userId, amount });
}

export async function requestNumber(
  formData: FormData
): Promise<ActionResult<{ orderId: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Non authentifié" };

  const provider = String(formData.get("provider") || "") as ProviderName;
  const country = String(formData.get("country") || "france") as Country;
  const service = String(formData.get("service") || "instagram") as Service;

  if (!provider) return { error: "Fournisseur manquant" };

  try {
    const client = getProvider(provider);
    const order = await client.buyNumber({ country, service });

    const actualCost = order.cost > 0 ? order.cost : DEFAULT_COST_USD;

    // Debit du wallet/budget VA
    const charged = await chargeVA(user.id, actualCost);
    if (!charged) {
      try {
        await client.cancelOrder(order.providerOrderId);
      } catch {}
      return { error: "Budget insuffisant pour ce VA (ou wallet agence vide)" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sms_orders")
      .insert({
        va_id: user.id,
        provider,
        provider_order_id: order.providerOrderId,
        phone: order.phone,
        service,
        country,
        operator: order.operator,
        status: "pending",
        cost: actualCost,
        expires_at: order.expiresAt?.toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Rollback : annule chez le provider + rembourse
      try {
        await client.cancelOrder(order.providerOrderId);
      } catch {}
      await refundVA(user.id, actualCost);
      return { error: `Achat OK mais sauvegarde échouée: ${error.message}` };
    }

    revalidatePath("/protected/numbers");
    revalidatePath("/protected");
    return { success: true, data: { orderId: data.id } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Mode AUTO : essaie tous les fournisseurs disponibles en cascade,
 * tries par prix croissant (le moins cher en premier).
 * Annote chaque essai avec le score historique du fournisseur.
 */
export async function requestNumberAuto(
  formData: FormData
): Promise<
  ActionResult<{
    orderId: string;
    provider: ProviderName;
    attempts: Array<{
      provider: string;
      ok: boolean;
      error?: string;
      price?: number;
      score?: number | null;
      attempts7d?: number;
    }>;
  }>
> {
  const user = await getAuthUser();
  if (!user) return { error: "Non authentifié" };

  const country = String(formData.get("country") || "france") as Country;
  const service = String(formData.get("service") || "instagram") as Service;

  const available = getAvailableProviders();
  if (available.length === 0) {
    return { error: "Aucun fournisseur SMS configuré dans .env.local" };
  }

  const attempts: Array<{
    provider: string;
    ok: boolean;
    error?: string;
    price?: number;
    score?: number | null;
    attempts7d?: number;
  }> = [];

  // Etape 1 : interroger les prix en parallele (chaque provider peut avoir plusieurs paliers)
  const priceResults = await Promise.allSettled(
    available.map(async (name) => {
      const client = getProvider(name);
      const info = await client.getPrice({ country, service });
      return { name, info };
    })
  );

  // Etape 2 : aplatir TOUS les paliers de tous les fournisseurs en un seul tableau, trie par prix
  type Candidate = {
    name: ProviderName;
    price: number;
    stock: number;
    label?: string;
  };
  const candidates: Candidate[] = [];

  priceResults.forEach((r, i) => {
    const providerName = available[i];
    if (r.status !== "fulfilled") {
      attempts.push({
        provider: PROVIDER_LABELS[providerName],
        ok: false,
        error: `Prix indisponible: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      });
      return;
    }
    const tiers = r.value.info.tiers || [];
    if (tiers.length === 0) {
      attempts.push({
        provider: PROVIDER_LABELS[providerName],
        ok: false,
        error: "Aucun palier de prix retourne",
      });
      return;
    }
    for (const t of tiers) {
      if (t.price <= 0) continue;
      // Filtre stock = 0 (si connu)
      if (t.stockCount !== undefined && t.stockCount <= 0) continue;
      candidates.push({
        name: providerName,
        price: t.price,
        stock: t.stockCount ?? -1,
        label: t.label,
      });
    }
  });

  // Tri global par prix croissant (mix tous fournisseurs et tous paliers)
  candidates.sort((a, b) => a.price - b.price);

  if (candidates.length === 0) {
    return {
      error: `Aucun fournisseur n'a de stock disponible pour ${country} / ${service}.`,
      // @ts-expect-error attached for UI
      attempts,
    };
  }

  // Etape 2.5 : recuperer les scores historiques (parallele, ~50ms total)
  const scores = new Map<ProviderName, { rate: number | null; n: number }>();
  await Promise.all(
    Array.from(new Set(candidates.map((c) => c.name))).map(async (name) => {
      const s = await getProviderScore(name, country, service, 7);
      scores.set(name, { rate: s.successRate, n: s.totalAttempts });
    })
  );

  // Etape 3 : essayer chaque palier dans l'ordre (avec maxPrice = prix de ce palier)
  for (const candidate of candidates) {
    const providerName = candidate.name;
    const maxPrice = candidate.price > 0 ? candidate.price : undefined;
    const providerLabel = candidate.label
      ? `${PROVIDER_LABELS[providerName]} (${candidate.label})`
      : PROVIDER_LABELS[providerName];
    const score = scores.get(providerName);
    try {
      const client = getProvider(providerName);
      const order = await client.buyNumber({ country, service, maxPrice });
      const actualCost = order.cost > 0 ? order.cost : DEFAULT_COST_USD;

      // Debit du wallet/budget
      const charged = await chargeVA(user.id, actualCost);
      if (!charged) {
        try {
          await client.cancelOrder(order.providerOrderId);
        } catch {}
        return {
          error: "Budget insuffisant pour ce VA (ou wallet agence vide)",
        };
      }

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("sms_orders")
        .insert({
          va_id: user.id,
          provider: providerName,
          provider_order_id: order.providerOrderId,
          phone: order.phone,
          service,
          country,
          operator: order.operator,
          status: "pending",
          cost: actualCost,
          expires_at: order.expiresAt?.toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        try {
          await client.cancelOrder(order.providerOrderId);
        } catch {}
        await refundVA(user.id, actualCost);
        attempts.push({
          provider: providerLabel,
          ok: false,
          error: `Sauvegarde DB échouée: ${error.message}`,
          price: candidate.price,
          score: score?.rate ?? null,
          attempts7d: score?.n ?? 0,
        });
        continue;
      }

      attempts.push({
        provider: providerLabel,
        ok: true,
        price: candidate.price,
        score: score?.rate ?? null,
        attempts7d: score?.n ?? 0,
      });
      revalidatePath("/protected/numbers");
      revalidatePath("/protected");
      return {
        success: true,
        data: { orderId: data.id, provider: providerName, attempts },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({
        provider: providerLabel,
        ok: false,
        error: msg.replace(`${providerName}: `, ""),
        price: candidate.price,
        score: score?.rate ?? null,
        attempts7d: score?.n ?? 0,
      });
    }
  }

  return {
    error: `Tous les fournisseurs ont échoué. Détail des essais ci-dessous.`,
    // @ts-expect-error attaching extra info for the UI
    attempts,
  };
}

export async function checkOrderStatus(
  orderId: string
): Promise<ActionResult<{ status: string; code: string | null }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Non authentifié" };

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("sms_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) return { error: "Commande introuvable" };

  if (
    order.status === "received" ||
    order.status === "finished" ||
    order.status === "canceled" ||
    order.status === "timeout"
  ) {
    return {
      success: true,
      data: { status: order.status, code: order.code },
    };
  }

  try {
    const client = getProvider(order.provider as ProviderName);
    const check = await client.checkCode(order.provider_order_id);

    const updates: Record<string, unknown> = {
      status: check.status,
      updated_at: new Date().toISOString(),
    };
    if (check.code) updates.code = check.code;
    if (check.smsText) updates.sms_text = check.smsText;

    // Si le statut passe a timeout/canceled cote provider -> rembourser
    if (
      (check.status === "timeout" || check.status === "canceled") &&
      order.status === "pending"
    ) {
      await refundVA(order.va_id, Number(order.cost));
      updates.finished_at = new Date().toISOString();
      revalidatePath("/protected");
    }

    await supabase.from("sms_orders").update(updates).eq("id", orderId);
    revalidatePath("/protected/numbers");

    return {
      success: true,
      data: { status: check.status, code: check.code },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelOrder(
  orderId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Non authentifié" };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("sms_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Commande introuvable" };

  try {
    const client = getProvider(order.provider as ProviderName);
    await client.cancelOrder(order.provider_order_id);

    // Rembourser le VA si pas de code reellement utilise
    // (pending OU received sans code = fausse alerte du provider)
    if (order.status === "pending" || (order.status === "received" && !order.code)) {
      await refundVA(order.va_id, Number(order.cost));
    }

    await supabase
      .from("sms_orders")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    revalidatePath("/protected/numbers");
    revalidatePath("/protected");
    return { success: true, message: "Commande annulée et remboursée" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function finishOrder(
  orderId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Non authentifié" };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("sms_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Commande introuvable" };

  try {
    const client = getProvider(order.provider as ProviderName);
    await client.finishOrder(order.provider_order_id);

    await supabase
      .from("sms_orders")
      .update({
        status: "finished",
        updated_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    revalidatePath("/protected/numbers");
    revalidatePath("/protected");
    return { success: true, message: "Commande clôturée" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getProviderBalance(
  provider: ProviderName
): Promise<ActionResult<{ balance: number }>> {
  try {
    const client = getProvider(provider);
    const balance = await client.getBalance();
    return { success: true, data: { balance } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
