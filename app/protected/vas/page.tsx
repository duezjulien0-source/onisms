import { requireAdmin } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { InviteVAButton } from "./invite-va-button";
import { VARowActions } from "./va-row-actions";

export default async function VAsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const vas = (users ?? []).filter((u) => u.role === "va");

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">VAs</h1>
        <InviteVAButton />
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Rôle</th>
              <th className="text-left p-3">Budget total</th>
              <th className="text-left p-3">Dépensé</th>
              <th className="text-left p-3">Pays</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Aucun VA pour le moment. Cliquez sur &laquo; + Créer un compte VA &raquo;.
                </td>
              </tr>
            ) : (
              vas.map((va) => (
                <tr key={va.id} className="border-t border-border">
                  <td className="p-3 font-medium">{va.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                      VA
                    </span>
                  </td>
                  <td className="p-3">${Number(va.budget_total).toFixed(2)}</td>
                  <td className="p-3 text-muted-foreground">
                    ${Number(va.budget_spent).toFixed(2)}
                  </td>
                  <td className="p-3">{va.country}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        va.status === "active"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {va.status === "active" ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td className="p-3">
                    <VARowActions
                      vaId={va.id}
                      vaEmail={va.email}
                      currentBudget={Number(va.budget_total)}
                      currentStatus={va.status}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
