/**
 * Adaptateur SMSPool.
 * Doc : https://www.smspool.net/article/how-to-use-the-smspool-api-0dd6eadf4c
 * Base URL : https://api.smspool.net
 * Auth : cle API passee en parametre `key` dans la query string.
 * Reponses : JSON.
 */

import type {
  SMSProvider,
  NumberOrder,
  CodeCheck,
  Country,
  Service,
  OrderStatus,
  PriceInfo,
} from "./types";

const BASE_URL = "https://api.smspool.net";

// IDs pays SMSPool (verifies via /country/retrieve_all)
const COUNTRY_MAP: Record<Country, string> = {
  france: "23",
  uk: "2",
  usa: "1",
  belgium: "75",
};

// IDs services SMSPool (verifies via /service/retrieve_all)
// Note : SMSPool bundle Instagram et Threads sous le meme ID
const SERVICE_MAP: Record<Service, string> = {
  instagram: "457",
  threads: "457",
};

// Status SMSPool : 1=pending, 3=received, 6=completed, 7=refunded/canceled
const STATUS_MAP: Record<number, OrderStatus> = {
  1: "pending",
  3: "received",
  6: "finished",
  7: "canceled",
};

class SMSPoolProvider implements SMSProvider {
  readonly name = "smspool";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    path: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const qs = new URLSearchParams({ key: this.apiKey, ...params });
    const url = `${BASE_URL}${path}?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`SMSPool ${path} → HTTP ${res.status}: ${text || "(vide)"}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`SMSPool ${path} → reponse non-JSON: ${text}`);
    }
  }

  async getBalance(): Promise<number> {
    const data = (await this.request("/request/balance")) as { balance?: number };
    return Number(data?.balance ?? 0);
  }

  async getPrice(opts: {
    country: Country;
    service: Service;
  }): Promise<PriceInfo> {
    const data = (await this.request("/request/price", {
      country: COUNTRY_MAP[opts.country],
      service: SERVICE_MAP[opts.service],
    })) as {
      price?: string | number;
      high_price?: string | number;
      success_rate?: number;
    };

    const low = Number(data?.price ?? 0);
    const high = Number(data?.high_price ?? 0);

    const tiers: PriceInfo["tiers"] = [];
    if (low > 0) tiers.push({ price: low, label: "low pool" });
    // 2e palier seulement si vraiment plus cher (pour eviter doublons)
    if (high > 0 && high > low + 0.001) {
      tiers.push({ price: high, label: "high pool" });
    }
    // Au cas ou aucun prix retourne
    if (tiers.length === 0) tiers.push({ price: 0 });

    return {
      tiers,
      successRate:
        data?.success_rate != null ? Number(data.success_rate) : undefined,
    };
  }

  async buyNumber(opts: {
    country: Country;
    service: Service;
    maxPrice?: number;
    operator?: string; // pas utilise par SMSPool, juste pour conformer a l'interface
  }): Promise<NumberOrder> {
    const params: Record<string, string> = {
      country: COUNTRY_MAP[opts.country],
      service: SERVICE_MAP[opts.service],
    };
    // Si maxPrice fourni, plafonne SMSPool (sinon ils vendent le pool le plus cher dispo)
    if (opts.maxPrice && opts.maxPrice > 0) {
      params.max_price = String(opts.maxPrice);
    }

    const data = (await this.request("/purchase/sms", params)) as {
      success?: number;
      order_id?: string | number;
      number?: string | number;
      cost?: number;
      message?: string;
      expires_in?: number;
    };

    if (!data?.order_id) {
      throw new Error(
        `SMSPool: ${data?.message || "echec de l'achat (peut-etre pas de numero sous le prix max)"}`
      );
    }

    const phoneRaw = String(data.number ?? "");
    return {
      providerOrderId: String(data.order_id),
      phone: phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`,
      cost: Number(data.cost ?? 0),
      expiresAt: data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000)
        : undefined,
    };
  }

  async checkCode(providerOrderId: string): Promise<CodeCheck> {
    const data = (await this.request("/sms/check", {
      orderid: providerOrderId,
    })) as {
      status?: number;
      sms?: string | null;
      full_sms?: string | null;
      code?: string | null;
    };

    const numStatus = Number(data?.status ?? 1);
    let status = STATUS_MAP[numStatus] || "pending";
    const code = data?.code ?? data?.sms ?? null;

    // Garde-fou : si le statut dit "received" mais pas de code, on reste en pending
    if (status === "received" && !code) {
      status = "pending";
    }

    return {
      status,
      code,
      smsText: data?.full_sms ?? null,
    };
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.request("/sms/cancel", { orderid: providerOrderId });
  }

  async finishOrder(providerOrderId: string): Promise<void> {
    // SMSPool n'a pas de "finish" explicite — l'archive sert a nettoyer.
    // On essaie l'archive, on ignore les erreurs.
    try {
      await this.request("/request/archive", { orderid: providerOrderId });
    } catch {
      // OK, pas critique
    }
  }
}

let _instance: SMSPoolProvider | null = null;
export function getSMSPool(): SMSPoolProvider {
  if (_instance) return _instance;
  const key = process.env.SMSPOOL_API_KEY;
  if (!key) {
    throw new Error("SMSPOOL_API_KEY manquant dans .env.local");
  }
  _instance = new SMSPoolProvider(key);
  return _instance;
}
