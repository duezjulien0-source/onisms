"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Zap, CheckCircle2, XCircle } from "lucide-react";
import { requestNumber, requestNumberAuto } from "./actions";
import { PROVIDER_LABELS, type ProviderName } from "@/lib/sms-providers";

interface Props {
  availableProviders: ProviderName[];
}

type Attempt = {
  provider: string;
  ok: boolean;
  error?: string;
  price?: number;
  score?: number | null;
  attempts7d?: number;
};

export function RequestNumberForm({ availableProviders }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  if (availableProviders.length === 0) {
    return (
      <div className="border border-dashed border-amber-500/50 rounded-lg p-6 bg-amber-500/5">
        <p className="text-sm text-amber-500">
          ⚠️ Aucun fournisseur SMS configuré. Ajoutez au moins une clé API
          (HEROSMS_API_KEY, SMSPOOL_API_KEY, FIVESIM_API_KEY...) dans le fichier{" "}
          <code className="bg-muted px-1 rounded">.env.local</code> puis
          redémarrez le serveur.
        </p>
      </div>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setAttempts([]);
    const providerChoice = formData.get("provider");

    startTransition(async () => {
      const isAuto = providerChoice === "auto";
      const result = isAuto
        ? await requestNumberAuto(formData)
        : await requestNumber(formData);

      if ("error" in result) {
        setError(result.error);
        const errAttempts = (result as { attempts?: Attempt[] }).attempts;
        if (Array.isArray(errAttempts)) setAttempts(errAttempts);
      } else {
        const data = result.data as { attempts?: Attempt[] } | undefined;
        if (Array.isArray(data?.attempts)) setAttempts(data.attempts);
        router.refresh();
      }
    });
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="text-primary" size={20} />
        <h2 className="font-semibold">Demander un nouveau numéro</h2>
      </div>

      <form
        action={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-4 gap-3"
      >
        <div className="md:col-span-1">
          <label className="text-xs text-muted-foreground block mb-1">
            Service
          </label>
          <select
            name="service"
            defaultValue="instagram"
            disabled={pending}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm cursor-pointer hover:border-primary/50 transition-colors"
          >
            <option value="instagram">Instagram</option>
            <option value="threads">Threads</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-muted-foreground block mb-1">
            Pays
          </label>
          <select
            name="country"
            defaultValue="france"
            disabled={pending}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm cursor-pointer hover:border-primary/50 transition-colors"
          >
            <option value="france">🇫🇷 France</option>
            <option value="uk">🇬🇧 Royaume-Uni</option>
            <option value="usa">🇺🇸 États-Unis</option>
            <option value="belgium">🇧🇪 Belgique</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-muted-foreground block mb-1">
            Fournisseur
          </label>
          <select
            name="provider"
            defaultValue="auto"
            disabled={pending}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm cursor-pointer hover:border-primary/50 transition-colors"
          >
            <option value="auto">⚡ Auto (essaie tous)</option>
            {availableProviders.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {pending ? (
              <>
                <Zap size={14} className="animate-pulse" />
                Recherche...
              </>
            ) : (
              "Demander"
            )}
          </button>
        </div>
      </form>

      {/* Mode Auto : afficher la liste des fournisseurs essayés (tries par prix) */}
      {attempts.length > 0 && (
        <div className="text-xs space-y-1 pt-2 border-t border-border">
          <div className="text-muted-foreground mb-1">
            Essais auto-fallback (triés du moins cher au plus cher) :
          </div>
          {attempts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              {a.ok ? (
                <CheckCircle2 size={12} className="text-green-500 shrink-0" />
              ) : (
                <XCircle size={12} className="text-red-500 shrink-0" />
              )}
              <span className={a.ok ? "text-green-500" : "text-muted-foreground"}>
                {a.provider}
              </span>
              {a.price !== undefined && a.price > 0 && (
                <span className="text-muted-foreground font-mono">
                  ${a.price.toFixed(3)}
                </span>
              )}
              {a.score !== undefined && a.score !== null && (
                <span
                  className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                    a.score >= 70
                      ? "bg-green-500/15 text-green-500"
                      : a.score >= 40
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-red-500/15 text-red-500"
                  }`}
                  title={`${a.attempts7d ?? 0} essais comptés sur 7 jours`}
                >
                  {a.score}%
                </span>
              )}
              {a.score === null && a.attempts7d === 0 && (
                <span className="text-muted-foreground/60 text-[10px] italic">
                  (pas d&apos;historique)
                </span>
              )}
              {a.error && (
                <span className="text-red-400 italic">— {a.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm p-3 rounded-md bg-red-500/10 text-red-500 border border-red-500/30">
          {error}
        </div>
      )}

      {availableProviders.length === 1 && (
        <p className="text-xs text-muted-foreground italic">
          💡 Un seul fournisseur configuré ({PROVIDER_LABELS[availableProviders[0]]}).
          Ajoutez d&apos;autres clés API dans <code className="bg-muted px-1 rounded">.env.local</code>
          pour activer le vrai fallback automatique sur les 5 fournisseurs.
        </p>
      )}
    </div>
  );
}
