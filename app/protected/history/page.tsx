import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { PROVIDER_LABELS, type ProviderName } from "@/lib/sms-providers";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface OrderWithVA {
  id: string;
  va_id: string;
  provider: string;
  phone: string;
  service: string;
  country: string;
  status: string;
  code: string | null;
  cost: number;
  created_at: string;
  finished_at: string | null;
  va_email?: string;
  va_name?: string | null;
}

export default async function HistoryPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // RLS s'occupe du filtrage : admin voit tout, VA voit ses propres
  const { data: ordersRaw } = await supabase
    .from("sms_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  // Joindre les infos VA (email/nom) si admin
  const orders: OrderWithVA[] = (ordersRaw ?? []) as OrderWithVA[];

  if (profile.role === "admin" && orders.length > 0) {
    const vaIds = [...new Set(orders.map((o) => o.va_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", vaIds);

    const profileMap = new Map(
      (profilesData ?? []).map((p) => [
        p.id,
        { email: p.email as string, display_name: p.display_name as string | null },
      ])
    );

    orders.forEach((o) => {
      const p = profileMap.get(o.va_id);
      o.va_email = p?.email;
      o.va_name = p?.display_name;
    });
  }

  // Stats globales
  const total = orders.length;
  const finished = orders.filter((o) => o.status === "finished").length;
  const canceled = orders.filter(
    (o) => o.status === "canceled" || o.status === "timeout"
  ).length;
  const totalCost = orders.reduce((s, o) => s + Number(o.cost), 0);
  const successRate = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Historique global</h1>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Commandes" value={String(total)} />
        <StatCard
          label="Réussies"
          value={`${finished} (${successRate}%)`}
          colorClass="text-green-500"
        />
        <StatCard
          label="Échouées"
          value={String(canceled)}
          colorClass="text-red-500"
        />
        <StatCard
          label="Coût total"
          value={`$${totalCost.toFixed(2)}`}
          colorClass="text-amber-500"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left p-3">Date</th>
                {profile.role === "admin" && (
                  <th className="text-left p-3">VA</th>
                )}
                <th className="text-left p-3">Service</th>
                <th className="text-left p-3">Pays</th>
                <th className="text-left p-3">Numéro</th>
                <th className="text-left p-3">Fournisseur</th>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Coût</th>
                <th className="text-left p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={profile.role === "admin" ? 9 : 8}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucune commande pour le moment.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    {profile.role === "admin" && (
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {o.va_name || o.va_email?.split("@")[0] || "—"}
                      </td>
                    )}
                    <td className="p-3 capitalize">{o.service}</td>
                    <td className="p-3 uppercase text-muted-foreground">
                      {o.country}
                    </td>
                    <td className="p-3 font-mono text-xs">{o.phone}</td>
                    <td className="p-3 text-muted-foreground">
                      {PROVIDER_LABELS[o.provider as ProviderName] || o.provider}
                    </td>
                    <td className="p-3 font-mono text-green-500">
                      {o.code || "—"}
                    </td>
                    <td className="p-3 font-mono">
                      ${Number(o.cost).toFixed(3)}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {orders.length === 200 && (
        <p className="text-xs text-muted-foreground text-center">
          Affichage des 200 dernières commandes. La pagination sera ajoutée si
          besoin.
        </p>
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; icon: React.ComponentType<{ size?: number }>; bg: string; color: string }
  > = {
    finished: {
      label: "Clôturé",
      icon: CheckCircle2,
      bg: "bg-green-500/15",
      color: "text-green-500",
    },
    received: {
      label: "Code reçu",
      icon: CheckCircle2,
      bg: "bg-green-500/15",
      color: "text-green-500",
    },
    pending: {
      label: "En attente",
      icon: Clock,
      bg: "bg-amber-500/15",
      color: "text-amber-500",
    },
    canceled: {
      label: "Annulé",
      icon: XCircle,
      bg: "bg-red-500/15",
      color: "text-red-500",
    },
    timeout: {
      label: "Expiré",
      icon: AlertCircle,
      bg: "bg-red-500/15",
      color: "text-red-500",
    },
    banned: {
      label: "Banni",
      icon: AlertCircle,
      bg: "bg-red-500/15",
      color: "text-red-500",
    },
  };

  const c = config[status] ?? {
    label: status,
    icon: AlertCircle,
    bg: "bg-muted",
    color: "text-muted-foreground",
  };
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${c.bg} ${c.color}`}
    >
      <Icon size={11} />
      {c.label}
    </span>
  );
}
