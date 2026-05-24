"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { checkOrderStatus, cancelOrder, finishOrder } from "./actions";
import { PROVIDER_LABELS, type ProviderName } from "@/lib/sms-providers";

interface Order {
  id: string;
  provider: string;
  phone: string;
  service: string;
  country: string;
  status: string;
  code: string | null;
  sms_text: string | null;
  cost: number;
  created_at: string;
  expires_at: string | null;
}

interface Props {
  order: Order;
}

// Delai minimum avant qu'on puisse annuler (en secondes)
// SMSPool exige ~2 min anti-abus, autres providers similaires
const CANCEL_COOLDOWN_SEC = 120;

export function OrderCard({ order: initialOrder }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [copied, setCopied] = useState<"phone" | "code" | null>(null);
  const [pending, startTransition] = useTransition();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const isActive = order.status === "pending";
  const canCancel = secondsAgo >= CANCEL_COOLDOWN_SEC;
  const cancelInSec = Math.max(0, CANCEL_COOLDOWN_SEC - secondsAgo);

  // Compteur temps ecoule
  useEffect(() => {
    const created = new Date(order.created_at).getTime();
    const tick = () => setSecondsAgo(Math.floor((Date.now() - created) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [order.created_at]);

  // Polling auto toutes les 5 sec tant que pending
  useEffect(() => {
    if (!isActive) return;
    const poll = async () => {
      const result = await checkOrderStatus(order.id);
      if ("success" in result && result.data) {
        if (
          result.data.status !== order.status ||
          result.data.code !== order.code
        ) {
          setOrder((o) => ({
            ...o,
            status: result.data!.status,
            code: result.data!.code,
          }));
          router.refresh();
        }
      }
    };
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [order.id, order.status, order.code, isActive, router]);

  const copy = (text: string, what: "phone" | "code") => {
    navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCancel = () => {
    setActionError(null);
    if (!confirm("Annuler cette commande ? Le numéro sera libéré et remboursé.")) return;
    startTransition(async () => {
      const result = await cancelOrder(order.id);
      if ("error" in result) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleFinish = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await finishOrder(order.id);
      if ("error" in result) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const statusBadge = () => {
    switch (order.status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-500">
            <Clock size={12} />
            En attente du code
          </span>
        );
      case "received":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/20 text-green-500">
            <CheckCircle2 size={12} />
            Code reçu
          </span>
        );
      case "finished":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-500">
            <CheckCircle2 size={12} />
            Clôturé
          </span>
        );
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-500">
            <X size={12} />
            Annulé
          </span>
        );
      case "timeout":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-500">
            <AlertCircle size={12} />
            Expiré
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
            {order.status}
          </span>
        );
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {order.service} · {order.country}
            </span>
            <span className="text-xs text-muted-foreground">
              via {PROVIDER_LABELS[order.provider as ProviderName] || order.provider}
            </span>
            {order.cost > 0 && (
              <span className="text-xs text-green-500 font-mono">
                ${Number(order.cost).toFixed(2)}
              </span>
            )}
          </div>
          {statusBadge()}
        </div>
        <div className="text-xs text-muted-foreground">{fmtTime(secondsAgo)}</div>
      </div>

      {/* Numéro */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">Numéro</div>
        <div className="flex items-center gap-2">
          <code className="text-lg font-mono font-bold bg-muted px-3 py-1.5 rounded">
            {order.phone}
          </code>
          <button
            onClick={() => copy(order.phone, "phone")}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="Copier"
          >
            {copied === "phone" ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Code */}
      {order.code && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Code SMS reçu</div>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-mono font-bold bg-green-500/10 text-green-500 px-3 py-1.5 rounded border border-green-500/30">
              {order.code}
            </code>
            <button
              onClick={() => copy(order.code!, "code")}
              className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="Copier"
            >
              {copied === "code" ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
          {order.sms_text && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              &ldquo;{order.sms_text}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Erreur d'action */}
      {actionError && (
        <div className="text-xs p-2 rounded-md bg-red-500/10 text-red-500 border border-red-500/30">
          ⚠️ {actionError}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
          <button
            onClick={handleCancel}
            disabled={pending || !canCancel}
            title={!canCancel
              ? `Disponible dans ${cancelInSec}s (anti-abus fournisseur)`
              : "Annuler et rembourser"}
            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!canCancel
              ? `Annuler (dispo dans ${cancelInSec}s)`
              : pending
                ? "Annulation..."
                : "Annuler le numéro"}
          </button>
          <p className="text-xs text-muted-foreground self-center">
            Rafraîchissement auto toutes les 5 sec
          </p>
        </div>
      )}
      {order.status === "received" && order.code && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <button
            onClick={handleFinish}
            disabled={pending}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            ✓ Code utilisé — Clôturer
          </button>
        </div>
      )}

      {order.status === "received" && !order.code && (
        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
          <p className="text-xs text-amber-500">
            ⚠️ Le fournisseur dit &laquo; code reçu &raquo; mais aucun code n&apos;est
            visible. Annulez pour récupérer le coût.
          </p>
          <button
            onClick={handleCancel}
            disabled={pending}
            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 disabled:opacity-50"
          >
            {pending ? "Annulation..." : "Annuler et rembourser"}
          </button>
        </div>
      )}
    </div>
  );
}
