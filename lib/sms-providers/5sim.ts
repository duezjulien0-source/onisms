import type {
  SMSProvider,
  NumberOrder,
  CodeCheck,
  Country,
  Service,
  OrderStatus,
  PriceInfo,
} from "./types";

const BASE_URL = "https://5sim.net/v1";

// Mapping noms internes -> noms 5SIM
const COUNTRY_MAP: Record<Country, string> = {
  france: "france",
  uk: "england",
  usa: "usa",
  belgium: "belgium",
};

const SERVICE_MAP: Record<Service, string> = {
  instagram: "instagram",
  threads: "threads",
};

class FiveSIMProvider implements SMSProvider {
  readonly name = "5sim";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(path: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      throw new Error(`5SIM ${path} → HTTP ${res.status}: ${text || "(empty)"}`);
    }
    // 5SIM renvoie parfois une string "no free phones" avec un 200
    if (typeof body === "string" && body.toLowerCase().includes("no free phones")) {
      throw new Error("5SIM: aucun numéro disponible pour cette combinaison pays/service");
    }
    return body;
  }

  async getBalance(): Promise<number> {
    const data = (await this.request("/user/profile")) as { balance?: number };
    return Number(data?.balance ?? 0);
  }

  async getPrice(opts: {
    country: Country;
    service: Service;
  }): Promise<PriceInfo> {
    const country = COUNTRY_MAP[opts.country];
    const service = SERVICE_MAP[opts.service];
    // Endpoint guest, pas besoin d'auth
    const res = await fetch(
      `${BASE_URL}/guest/prices?country=${country}&product=${service}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { tiers: [{ price: 0, stockCount: 0 }] };
    const data = (await res.json()) as Record<
      string,
      Record<
        string,
        Record<string, { cost?: number; count?: number; rate?: number }>
      >
    >;
    const operators = data?.[country]?.[service];
    if (!operators) return { tiers: [{ price: 0, stockCount: 0 }] };

    // Un palier par operateur ayant du stock, tri par prix
    const tiers: PriceInfo["tiers"] = [];
    let bestRate = 0;
    for (const [opName, op] of Object.entries(operators)) {
      const count = Number(op?.count ?? 0);
      if (count <= 0) continue;
      tiers.push({
        price: Number(op?.cost ?? 0),
        stockCount: count,
        label: opName,
      });
      const rate = Number(op?.rate ?? 0);
      if (rate > bestRate) bestRate = rate;
    }
    if (tiers.length === 0) return { tiers: [{ price: 0, stockCount: 0 }] };
    tiers.sort((a, b) => a.price - b.price);
    return { tiers, successRate: bestRate > 0 ? bestRate : undefined };
  }

  async buyNumber(opts: {
    country: Country;
    service: Service;
    maxPrice?: number;
  }): Promise<NumberOrder> {
    const country = COUNTRY_MAP[opts.country];
    const service = SERVICE_MAP[opts.service];
    // 5SIM supporte maxPrice en query param
    const qs = opts.maxPrice && opts.maxPrice > 0
      ? `?maxPrice=${opts.maxPrice}`
      : "";
    const data = (await this.request(
      `/user/buy/activation/${country}/any/${service}${qs}`
    )) as {
      id?: number | string;
      phone?: string;
      operator?: string;
      price?: number;
      expires?: string;
    };

    if (data?.id == null || !data.phone) {
      throw new Error("5SIM: réponse invalide à l'achat du numéro");
    }

    return {
      providerOrderId: String(data.id),
      phone: data.phone,
      operator: data.operator,
      cost: Number(data.price ?? 0),
      expiresAt: data.expires ? new Date(data.expires) : undefined,
    };
  }

  async checkCode(providerOrderId: string): Promise<CodeCheck> {
    const data = (await this.request(`/user/check/${providerOrderId}`)) as {
      status?: string;
      sms?: Array<{ code?: string; text?: string }>;
    };

    let status = mapStatus(data?.status);
    const lastSms = data?.sms?.[data.sms.length - 1];
    const code = lastSms?.code ?? null;

    // Garde-fou : 5SIM marque parfois "RECEIVED" sans code dans le sms array
    // (fausse alerte, residu, etc.) → on reste en "pending" pour continuer le polling
    if (status === "received" && !code) {
      status = "pending";
    }

    return {
      status,
      code,
      smsText: lastSms?.text ?? null,
    };
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    await this.request(`/user/cancel/${providerOrderId}`);
  }

  async finishOrder(providerOrderId: string): Promise<void> {
    await this.request(`/user/finish/${providerOrderId}`);
  }
}

function mapStatus(s: string | undefined): OrderStatus {
  switch (s) {
    case "PENDING":
      return "pending";
    case "RECEIVED":
      return "received";
    case "CANCELED":
      return "canceled";
    case "TIMEOUT":
      return "timeout";
    case "BANNED":
      return "banned";
    case "FINISHED":
      return "finished";
    default:
      return "pending";
  }
}

let _instance: FiveSIMProvider | null = null;
export function getFiveSIM(): FiveSIMProvider {
  if (_instance) return _instance;
  const key = process.env.FIVESIM_API_KEY;
  if (!key) {
    throw new Error(
      "FIVESIM_API_KEY manquant dans .env.local — voir les consignes dans le chat."
    );
  }
  _instance = new FiveSIMProvider(key);
  return _instance;
}
