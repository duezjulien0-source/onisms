"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { rechargeWallet } from "./vas/actions";

export function RechargeWalletButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await rechargeWallet(formData);
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: result.message || "Wallet rechargé",
        });
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
        }, 1500);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-md text-sm font-medium hover:opacity-90 transition"
      >
        <Plus size={14} />
        Recharger
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Recharger le wallet de l&apos;agence</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Saisissez le montant que vous avez ajouté chez vos fournisseurs SMS
              (la somme totale disponible pour vos VAs).
            </p>

            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Montant à ajouter (USD)
                </label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="0.01"
                  step="0.01"
                  defaultValue="50"
                  disabled={pending}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {message && (
                <div
                  className={`text-sm p-2 rounded-md ${
                    message.type === "success"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "..." : "Recharger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
