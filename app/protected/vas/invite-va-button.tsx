"use client";

import { useState, useTransition } from "react";
import { inviteVA } from "./actions";

export function InviteVAButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await inviteVA(formData);
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: result.message || "Invitation envoyée",
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
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition"
      >
        + Créer un compte VA
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
            <h2 className="text-lg font-semibold mb-4">Inviter un nouveau VA</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Un email d&apos;invitation sera envoyé. Le VA cliquera dessus pour
              choisir son mot de passe et accéder au tableau de bord.
            </p>

            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Email du VA
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="va@example.com"
                  disabled={pending}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Budget initial (USD)
                </label>
                <input
                  type="number"
                  name="budget"
                  defaultValue="10"
                  min="0"
                  step="0.5"
                  disabled={pending}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Montant que le VA pourra dépenser. Peut être modifié plus tard.
                </p>
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
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Envoi..." : "Envoyer l'invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
