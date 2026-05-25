import { Wallet, AlertCircle } from "lucide-react";
import {
  getAvailableProviders,
  getProvider,
  PROVIDER_LABELS,
  type ProviderName,
} from "@/lib/sms-providers";

interface BalanceResult {
  name: ProviderName;
  label: string;
  balance: number | null;
  error: string | null;
}

async function fetchAllBalances(): Promise<BalanceResult[]> {
  const providers = getAvailableProviders();
  const results = await Promise.allSettled(
    providers.map(async (name) => {
      const client = getProvider(name);
      const balance = await client.getBalance();
      return { name, balance };
    })
  );

  return results.map((r, i) => {
    const name = providers[i];
    if (r.status === "fulfilled") {
      return {
        name,
        label: PROVIDER_LABELS[name],
        balance: r.value.balance,
        error: null,
      };
    }
    return {
      name,
      label: PROVIDER_LABELS[name],
      balance: null,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

function priceColor(balance: number): string {
  if (balance < 1) return "text-red-500";
  if (balance < 5) return "text-amber-500";
  return "text-green-500";
}

function priceLabel(balance: number): string {
  if (balance < 1) return "⚠️ Recharge urgente";
  if (balance < 5) return "🟡 Faible";
  return "✓ OK";
}

export async function ProviderBalances() {
  const balances = await fetchAllBalances();

  if (balances.length === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="text-primary" size={18} />
        <h2 className="font-semibold">Soldes fournisseurs SMS</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {balances.map((b) => (
          <div
            key={b.name}
            className="border border-border rounded-md p-4 bg-background"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {b.label}
              </span>
              {b.error && (
                <AlertCircle size={12} className="text-red-500" />
              )}
            </div>

            {b.error ? (
              <>
                <div className="text-sm text-red-500 font-medium">
                  Erreur
                </div>
                <div
                  className="text-[10px] text-muted-foreground mt-1 truncate"
                  title={b.error}
                >
                  {b.error}
                </div>
              </>
            ) : (
              <>
                <div className={`text-2xl font-bold ${priceColor(b.balance!)}`}>
                  ${b.balance!.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {priceLabel(b.balance!)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3">
        💡 Rafraîchissez la page (F5) pour mettre à jour les soldes.
      </p>
    </div>
  );
}

export function ProviderBalancesSkeleton() {
  return (
    <div className="border border-border rounded-lg p-6 bg-card animate-pulse">
      <div className="h-5 w-48 bg-muted rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-md p-4">
            <div className="h-3 w-20 bg-muted rounded mb-2" />
            <div className="h-7 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
