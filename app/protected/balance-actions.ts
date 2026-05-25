"use server";

import {
  getAvailableProviders,
  getProvider,
  PROVIDER_LABELS,
  type ProviderName,
} from "@/lib/sms-providers";

export interface TotalBalanceResult {
  total: number;
  workingProviders: number;
  totalProviders: number;
  breakdown: Array<{ name: ProviderName; label: string; balance: number | null }>;
}

/**
 * Recupere le solde de tous les fournisseurs configures et calcule la somme.
 * Si un fournisseur est en erreur, on l'ignore dans la somme mais on le liste.
 */
export async function getTotalProviderBalance(): Promise<TotalBalanceResult> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    return {
      total: 0,
      workingProviders: 0,
      totalProviders: 0,
      breakdown: [],
    };
  }

  const results = await Promise.allSettled(
    providers.map(async (name) => ({
      name,
      balance: await getProvider(name).getBalance(),
    }))
  );

  let total = 0;
  let workingProviders = 0;
  const breakdown: TotalBalanceResult["breakdown"] = [];

  results.forEach((r, i) => {
    const name = providers[i];
    const label = PROVIDER_LABELS[name];
    if (r.status === "fulfilled") {
      total += r.value.balance;
      workingProviders++;
      breakdown.push({ name, label, balance: r.value.balance });
    } else {
      breakdown.push({ name, label, balance: null });
    }
  });

  return {
    total,
    workingProviders,
    totalProviders: providers.length,
    breakdown,
  };
}
