import type { SMSProvider } from "./types";
import { getFiveSIM } from "./5sim";
import { getHeroSMS, getSMSActivate } from "./sms-activate-compat";
import { getSMSPool } from "./smspool";

export type ProviderName = "hero-sms" | "5sim" | "sms-activate" | "smspool";

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  "hero-sms": "HeroSMS",
  "5sim": "5SIM",
  "sms-activate": "SMS-Activate",
  smspool: "SMSPool",
};

/** Renvoie une instance du fournisseur demande. Throw si la cle env manque. */
export function getProvider(name: ProviderName): SMSProvider {
  switch (name) {
    case "hero-sms":
      return getHeroSMS();
    case "5sim":
      return getFiveSIM();
    case "sms-activate":
      return getSMSActivate();
    case "smspool":
      return getSMSPool();
    default:
      throw new Error(`Provider inconnu: ${name}`);
  }
}

/** Liste les fournisseurs dont la cle API est configuree dans .env.local */
export function getAvailableProviders(): ProviderName[] {
  const available: ProviderName[] = [];
  if (process.env.HEROSMS_API_KEY) available.push("hero-sms");
  if (process.env.FIVESIM_API_KEY) available.push("5sim");
  if (process.env.SMSPOOL_API_KEY) available.push("smspool");
  if (process.env.SMS_ACTIVATE_API_KEY) available.push("sms-activate");
  return available;
}
