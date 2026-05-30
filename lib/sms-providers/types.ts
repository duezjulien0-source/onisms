/**
 * Types communs pour tous les fournisseurs SMS.
 * Chaque fournisseur (5SIM, SMSPool, etc.) implemente l'interface SMSProvider.
 */

export type Country = "france" | "uk" | "usa" | "belgium";
export type Service = "instagram" | "threads";

export type OrderStatus =
  | "pending"   // en attente du SMS
  | "received"  // SMS recu, code disponible
  | "canceled"  // annule par le VA (souvent rembourse)
  | "timeout"   // delai expire sans recevoir de code
  | "banned"    // numero banni par la plateforme cible
  | "finished"; // commande cloturee avec succes

export interface NumberOrder {
  providerOrderId: string;
  phone: string;
  operator?: string;
  cost: number;
  expiresAt?: Date;
}

export interface CodeCheck {
  status: OrderStatus;
  code: string | null;
  smsText: string | null;
}

export interface PriceTier {
  /** Prix unitaire en USD pour ce palier */
  price: number;
  /** Nombre de numeros disponibles a ce prix (si dispo) */
  stockCount?: number;
  /** Label optionnel : "low", "high", "physical", nom d'operateur, etc. */
  label?: string;
}

export interface PriceInfo {
  /** 1 a N paliers de prix possibles (ex: SMSPool a low/high pool) */
  tiers: PriceTier[];
  /** Taux de succes 0-100 si le fournisseur le communique */
  successRate?: number;
}

export interface SMSProvider {
  /** Nom court du fournisseur (5sim, smspool, etc.) */
  readonly name: string;

  /** Solde actuel disponible chez le fournisseur, en USD */
  getBalance(): Promise<number>;

  /** Prix actuel et stock pour ce service/pays */
  getPrice(opts: { country: Country; service: Service }): Promise<PriceInfo>;

  /** Achete un numero pour un service/pays donne.
   * - maxPrice : plafond de prix (le fournisseur refuse si pas dispo en dessous)
   * - operator : nom de l'operateur specifique (utile pour 5SIM qui a lebara, virtual51, etc.)
   */
  buyNumber(opts: {
    country: Country;
    service: Service;
    maxPrice?: number;
    operator?: string;
  }): Promise<NumberOrder>;

  /** Verifie si un SMS est arrive pour cette commande */
  checkCode(providerOrderId: string): Promise<CodeCheck>;

  /** Annule la commande (souvent remboursee si SMS non recu) */
  cancelOrder(providerOrderId: string): Promise<void>;

  /** Cloture la commande comme reussie (apres reception du code) */
  finishOrder(providerOrderId: string): Promise<void>;
}
