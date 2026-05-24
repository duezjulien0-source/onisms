import { getAgencyWallet, getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { RechargeWalletButton } from "./recharge-wallet-button";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const wallet = await getAgencyWallet();
  const supabase = await createClient();

  const { count: activeVas } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "va")
    .eq("status", "active");

  const balance = wallet?.balance ?? 0;
  const totalRecharged = wallet?.total_recharged ?? 0;
  const spent = totalRecharged - balance;
  const usagePct =
    totalRecharged > 0 ? Math.min(100, (spent / totalRecharged) * 100) : 0;

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

      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Balance de l&apos;agence
            </div>
            <div className="text-4xl font-bold mt-1">
              ${balance.toFixed(2)}
              <span className="text-sm text-muted-foreground font-normal ml-2">
                restant
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Dépensé : <span className="text-green-500">${spent.toFixed(2)}</span>{" "}
              / Budget total :{" "}
              <span className="text-foreground">${totalRecharged.toFixed(2)}</span>
            </div>
          </div>
          {profile.role === "admin" && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                VAs
              </div>
              <div className="text-2xl font-bold mt-1">
                {activeVas ?? 0}
              </div>
            </div>
          )}
        </div>
        <div className="h-2 bg-muted rounded overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>$0</span>
          <span className="text-green-500">{Math.round(usagePct)}% utilisé</span>
          <span>${totalRecharged.toFixed(0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Numéros aujourd'hui" value="0" colorClass="text-primary" />
        <StatCard label="Coût aujourd'hui" value="$0.000" colorClass="text-green-500" />
        <StatCard
          label="VAs actifs"
          value={String(activeVas ?? 0)}
          colorClass="text-amber-500"
        />
      </div>

      {profile.role === "admin" && (
        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-semibold mb-2">VAs ({activeVas ?? 0})</h2>
          <p className="text-sm text-muted-foreground">
            {(activeVas ?? 0) === 0
              ? "Aucun VA pour le moment. Allez dans « Mes VAs » pour en inviter."
              : "Voir la liste complète dans « Mes VAs »."}
          </p>
        </div>
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
