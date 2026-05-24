/**
 * Adaptateur pour les fournisseurs compatibles SMS-Activate.
 * Utilise par HeroSMS et SMS-Activate (meme protocole, URL differente).
 *
 * Protocole legacy : reponses texte separees par des deux-points
 * Ex: "ACCESS_BALANCE:50.00", "ACCESS_NUMBER:25:33612345678"
 */

import type {
  SMSProvider,
  NumberOrder,
  CodeCheck,
  Country,
  Service,
  PriceInfo,
} from "./types";

// Codes pays utilises par SMS-Activate (numeriques)
const COUNTRY_MAP: Record<Country, string> = {
  france: "78",
  uk: "16",
  usa: "187",
  belgium: "82",
};

// Codes service SMS-Activate
const SERVICE_MAP: Record<Service, string> = {
  instagram: "ig",
  threads: "ths", // a verifier — sinon fallback sur "ig"
};

class SMSActivateCompatProvider implements SMSProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(name: string, apiKey: string, baseUrl: string) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request(
    action: string,
    params: Record<string, string> = {}
  ): Promise<string> {
    const qs = new URLSearchParams({
      api_key: this.apiKey,
      action,
      ...params,
    });
    const url = `${this.baseUrl}/stubs/handler_api.php?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`${this.name} ${action} → HTTP ${res.status}`);
    }
    const text = (await res.text()).trim();
    // Erreurs explicites communes
    if (
      text === "BAD_KEY" ||
      text === "ERROR_SQL" ||
      text === "BANNED" ||
      text === "WRONG_USER_KEY"
    ) {
      throw new Error(`${this.name}: ${text}`);
    }
    return text;
  }

  async getBalance(): Promise<number> {
    const text = await this.request("getBalance");
    // Format: "ACCESS_BALANCE:50.00"
    if (text.startsWith("ACCESS_BALANCE:")) {
      return Number(text.split(":")[1]);
    }
    throw new Error(`${this.name}: reponse balance inattendue: ${text}`);
  }

  async getPrice(opts: {
    country: Country;
    service: Service;
  }): Promise<PriceInfo> {
    const countryCode = COUNTRY_MAP[opts.country];
    const serviceCode = SERVICE_MAP[opts.service];
    const text = await this.request("getPrices", {
      country: countryCode,
      service: serviceCode,
    });
    // Format JSON : {"78":{"ig":{"cost":0.085,"count":858,"physicalCount":33}}}
    try {
      const parsed = JSON.parse(text) as Record<
        string,
        Record<string, { cost?: number; count?: number; physicalCount?: number }>
      >;
      const info = parsed?.[countryCode]?.[serviceCode];
      if (!info) return { tiers: [{ price: 0, stockCount: 0 }] };
      return {
        tiers: [
          {
            price: Number(info.cost ?? 0),
            stockCount: Number(info.physicalCount ?? info.count ?? 0),
          },
        ],
      };
    } catch {
      return { tiers: [{ price: 0, stockCount: 0 }] };
    }
  }

  async buyNumber(opts: {
    country: Country;
    service: Service;
  }): Promise<NumberOrder> {
    const text = await this.request("getNumber", {
      service: SERVICE_MAP[opts.service],
      country: COUNTRY_MAP[opts.country],
    });
    // Format succes: "ACCESS_NUMBER:25:33612345678"
    if (text.startsWith("ACCESS_NUMBER:")) {
      const parts = text.split(":");
      const id = parts[1];
      const phone = parts[2];
      return {
        providerOrderId: id,
        phone: phone.startsWith("+") ? phone : `+${phone}`,
        cost: 0, // ce protocole ne renvoie pas le prix a l'achat
      };
    }
    if (text === "NO_NUMBERS") {
      throw new Error(
        `${this.name}: aucun numero disponible pour ${opts.country} / ${opts.service}`
      );
    }
    if (text === "NO_BALANCE") {
      throw new Error(`${this.name}: solde insuffisant chez le fournisseur`);
    }
    throw new Error(`${this.name}: reponse achat inattendue: ${text}`);
  }

  async checkCode(providerOrderId: string): Promise<CodeCheck> {
    const text = await this.request("getStatus", { id: providerOrderId });
    // STATUS_WAIT_CODE = en attente
    // STATUS_WAIT_RESEND = sms recu une fois, en attente d'un nouveau
    // STATUS_OK:CODE = code recu
    // STATUS_CANCEL = annule
    if (text === "STATUS_WAIT_CODE" || text === "STATUS_WAIT_RESEND") {
      return { status: "pending", code: null, smsText: null };
    }
    if (text.startsWith("STATUS_OK:")) {
      const code = text.split(":")[1] || null;
      return { status: "received", code, smsText: null };
    }
    if (text === "STATUS_CANCEL") {
      return { status: "canceled", code: null, smsText: null };
    }
    // Inconnu — on reste en pending pour pas casser
    return { status: "pending", code: null, smsText: null };
  }

  async cancelOrder(providerOrderId: string): Promise<void> {
    // status=8 → annulation
    await this.request("setStatus", { id: providerOrderId, status: "8" });
  }

  async finishOrder(providerOrderId: string): Promise<void> {
    // status=6 → activation reussie (cloture, pas de remboursement)
    await this.request("setStatus", { id: providerOrderId, status: "6" });
  }
}

let _heroSms: SMSActivateCompatProvider | null = null;
export function getHeroSMS(): SMSActivateCompatProvider {
  if (_heroSms) return _heroSms;
  const key = process.env.HEROSMS_API_KEY;
  if (!key) {
    throw new Error(
      "HEROSMS_API_KEY manquant dans .env.local — voir consignes dans le chat."
    );
  }
  _heroSms = new SMSActivateCompatProvider(
    "hero-sms",
    key,
    "https://hero-sms.com"
  );
  return _heroSms;
}

let _smsActivate: SMSActivateCompatProvider | null = null;
export function getSMSActivate(): SMSActivateCompatProvider {
  if (_smsActivate) return _smsActivate;
  const key = process.env.SMS_ACTIVATE_API_KEY;
  if (!key) {
    throw new Error(
      "SMS_ACTIVATE_API_KEY manquant dans .env.local — voir consignes dans le chat."
    );
  }
  _smsActivate = new SMSActivateCompatProvider(
    "sms-activate",
    key,
    "https://api.sms-activate.ae"
  );
  return _smsActivate;
}
