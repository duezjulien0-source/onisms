import { createClient } from "./supabase/server";
import type { Country, Service } from "./sms-providers/types";
import type { ProviderName } from "./sms-providers";

export interface ProviderScore {
  /** Taux de reussite 0-100, null si pas assez de donnees */
  successRate: number | null;
  /** Nombre d'essais concluants pris en compte */
  totalAttempts: number;
  /** Confidence : "low" si < 5 essais, "medium" si 5-20, "high" si > 20 */
  confidence: "low" | "medium" | "high";
}

/**
 * Recupere le taux de reussite historique d'un fournisseur
 * pour un pays/service donne, sur les N derniers jours (7 par defaut).
 */
export async function getProviderScore(
  provider: ProviderName,
  country: Country,
  service: Service,
  days: number = 7
): Promise<ProviderScore> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_provider_success_rate", {
    p_provider: provider,
    p_country: country,
    p_service: service,
    p_days: days,
  });

  if (error || !data || data.length === 0) {
    return { successRate: null, totalAttempts: 0, confidence: "low" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const totalAttempts = Number(row.total_attempts ?? 0);
  const successRate =
    row.success_rate != null ? Number(row.success_rate) : null;

  let confidence: ProviderScore["confidence"];
  if (totalAttempts < 5) confidence = "low";
  else if (totalAttempts <= 20) confidence = "medium";
  else confidence = "high";

  return { successRate, totalAttempts, confidence };
}
