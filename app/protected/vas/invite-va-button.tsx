"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { inviteVA, createVADirect } from "./actions";

type Mode = "invite" | "direct";

function generatePassword(): string {
  // 12 caracteres, evite les confusions (pas de 0/O, 1/l/I)
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export function InviteVAButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("direct");
  const [password, setPassword] = useState(generatePassword());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setOpen(false);
    setMessage(null);
    setCreatedCreds(null);
    setCopied(false);
    setMode("direct");
    setPassword(generatePassword());
  };

  const handleSubmit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result =
        mode === "direct"
          ? await createVADirect(formData)
          : await inviteVA(formData);

      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
      } else {
        const creds = (result as { data?: { email: string; password: string } })
          .data;
        if (mode === "direct" && creds?.email && creds?.password) {
          setCreatedCreds(creds);
        } else {
          setMessage({
            type: "success",
            text: result.message || "Invitation envoyée",
          });
          setTimeout(reset, 1500);
        }
      }
    });
  };

  const copyCredentials = () => {
    if (!createdCreds) return;
    const text = `Email: ${createdCreds.email}\nMot de passe: ${createdCreds.password}\nURL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          onClick={() => !pending && reset()}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {createdCreds ? (
              // ====== Ecran : credentials a transmettre ======
              <>
                <h2 className="text-lg font-semibold mb-2 text-green-500">
                  ✓ Compte créé avec succès
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Transmettez ces identifiants à votre VA via Signal / WhatsApp /
                  autre canal sécurisé. Il pourra se connecter immédiatement.
                </p>

                <div className="space-y-3 bg-muted/30 border border-border rounded-md p-4 font-mono text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                      Email
                    </div>
                    <div>{createdCreds.email}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                      Mot de passe
                    </div>
                    <div className="break-all">{createdCreds.password}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                      URL de connexion
                    </div>
                    <div className="break-all">{typeof window !== "undefined" ? window.location.origin : ""}</div>
                  </div>
                </div>

                <button
                  onClick={copyCredentials}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-green-300" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copier les identifiants
                    </>
                  )}
                </button>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mt-4 text-xs text-amber-500">
                  ⚠️ Notez ce mot de passe maintenant — il ne sera pas
                  réaffiché. Le VA pourra le changer après sa 1ère connexion.
                </div>

                <button
                  onClick={reset}
                  className="mt-4 w-full px-4 py-2 text-sm border border-border rounded-md hover:bg-muted"
                >
                  Fermer
                </button>
              </>
            ) : (
              // ====== Ecran : formulaire de creation ======
              <>
                <h2 className="text-lg font-semibold mb-4">
                  Nouveau compte VA
                </h2>

                {/* Toggle mode */}
                <div className="flex bg-muted rounded-md p-1 mb-4">
                  <button
                    type="button"
                    onClick={() => setMode("direct")}
                    disabled={pending}
                    className={`flex-1 py-1.5 text-xs rounded transition ${
                      mode === "direct"
                        ? "bg-card font-medium shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Créer avec mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("invite")}
                    disabled={pending}
                    className={`flex-1 py-1.5 text-xs rounded transition ${
                      mode === "invite"
                        ? "bg-card font-medium shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    Inviter par email
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  {mode === "direct"
                    ? "Le compte est utilisable immédiatement. Vous récupérez le mot de passe à transmettre manuellement au VA."
                    : "Un email d'invitation est envoyé. Le VA clique dessus pour définir son propre mot de passe."}
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

                  {mode === "direct" && (
                    <div>
                      <label className="text-sm font-medium block mb-1.5">
                        Mot de passe
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={pending}
                          minLength={8}
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setPassword(generatePassword())}
                          disabled={pending}
                          title="Générer un nouveau mot de passe"
                          className="px-3 py-2 border border-border rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-généré, modifiable. Le VA pourra le changer plus tard.
                      </p>
                    </div>
                  )}

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
                      Plafond de dépense pour ce VA. Modifiable plus tard.
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
                      onClick={reset}
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
                      {pending
                        ? "..."
                        : mode === "direct"
                          ? "Créer le compte"
                          : "Envoyer l'invitation"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
