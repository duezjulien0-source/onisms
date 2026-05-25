import { Suspense } from "react";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { RechargeWalletButton } from "./recharge-wallet-button";
import {
  ProviderBalances,
  ProviderBalancesSkeleton,
} from "./provider-balances";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { count: activeVas } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "va")
    .eq("status", "active");

  const displayName = profile.display_name || profile.email.split("@")[0];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Dashboard{" "}
          <span className="text-muted-foreground font-normal">— {displayName}</span>
        </h1>
        {profile.role === "admin" && <RechargeWalletButton />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Numéros aujourd'hui" value="0" colorClass="text-green-500" />
        <StatCard label="Coût aujourd'hui" value="$0.000" colorClass="text-green-500" />
        <StatCard
          label="VAs actifs"
          value={String(activeVas ?? 0)}
          colorClass="text-green-500"
        />
      </div>

      {profile.role === "admin" && (
        <Suspense fallback={<ProviderBalancesSkeleton />}>
          <ProviderBalances />
        </Suspense>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass = "",
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</div>
    </div>
  );
}
