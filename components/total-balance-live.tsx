"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import {
  getTotalProviderBalance,
  type TotalBalanceResult,
} from "@/app/protected/balance-actions";

const REFRESH_INTERVAL_MS = 30_000;

export function TotalBalanceLive() {
  const [data, setData] = useState<TotalBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getTotalProviderBalance();
      setData(r);
      setLastUpdate(Date.now());
    } catch (e) {
      console.error("Failed to fetch balances:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchBalance();
    const timer = setInterval(fetchBalance, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchBalance]);

  // Compteur visuel "il y a Xs"
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="p-4 border-b border-border">
        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
          Solde total
        </div>
        <div className="text-xl font-bold text-muted-foreground mt-1">…</div>
      </div>
    );
  }

  if (data.totalProviders === 0) {
    return (
      <div className="p-4 border-b border-border">
        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
          Solde total
        </div>
        <div className="text-xs text-amber-500 mt-1">
          Aucun fournisseur configuré
        </div>
      </div>
    );
  }

  const colorClass =
    data.total < 5
      ? "text-red-500"
      : data.total < 20
        ? "text-amber-500"
        : "text-green-500";

  const secondsAgo =
    lastUpdate != null ? Math.floor((now - lastUpdate) / 1000) : 0;

  return (
    <div className="p-4 border-b border-border group">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
          Solde total
        </div>
        <button
          onClick={fetchBalance}
          disabled={loading}
          title="Rafraîchir maintenant"
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className={`text-xl font-bold mt-1 ${colorClass}`}>
        ${data.total.toFixed(2)}
      </div>

      {/* Breakdown détaillé */}
      <div className="mt-2 space-y-0.5">
        {data.breakdown.map((b) => (
          <div
            key={b.name}
            className="flex justify-between items-center text-[10px]"
          >
            <span className="text-muted-foreground">{b.label}</span>
            {b.balance != null ? (
              <span className="font-mono text-foreground/80">
                ${b.balance.toFixed(2)}
              </span>
            ) : (
              <span className="text-red-500">erreur</span>
            )}
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="text-[9px] text-muted-foreground mt-2">
        {data.workingProviders}/{data.totalProviders} OK · maj{" "}
        {secondsAgo < 5 ? "à l'instant" : `il y a ${secondsAgo}s`}
      </div>
    </div>
  );
}
