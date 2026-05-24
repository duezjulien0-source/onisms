import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getAvailableProviders } from "@/lib/sms-providers";
import { RequestNumberForm } from "./request-form";
import { OrderCard } from "./order-card";

export default async function NumbersPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const availableProviders = getAvailableProviders();

  // Charger les commandes : actives + 10 dernieres terminees
  const baseQuery = supabase
    .from("sms_orders")
    .select("*")
    .order("created_at", { ascending: false });

  const query =
    profile.role === "admin" ? baseQuery : baseQuery.eq("va_id", profile.id);

  const { data: orders } = await query.limit(30);

  const activeOrders = (orders ?? []).filter(
    (o) => o.status === "pending" || o.status === "received"
  );
  const recentOrders = (orders ?? []).filter(
    (o) =>
      o.status === "finished" ||
      o.status === "canceled" ||
      o.status === "timeout" ||
      o.status === "banned"
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Mes numéros</h1>

      <RequestNumberForm availableProviders={availableProviders} />

      {/* Commandes actives */}
      <div>
        <h2 className="font-semibold mb-3">
          Commandes en cours ({activeOrders.length})
        </h2>
        {activeOrders.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground bg-card">
            Aucune commande active. Demandez un numéro ci-dessus.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Historique recent */}
      {recentOrders.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Historique récent</h2>
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Numéro</th>
                  <th className="text-left p-3">Service</th>
                  <th className="text-left p-3">Fournisseur</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 20).map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 font-mono">{order.phone}</td>
                    <td className="p-3">{order.service}</td>
                    <td className="p-3 text-muted-foreground">{order.provider}</td>
                    <td className="p-3 font-mono">{order.code || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          order.status === "finished"
                            ? "bg-blue-500/20 text-blue-400"
                            : order.status === "canceled"
                              ? "bg-red-500/20 text-red-500"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
