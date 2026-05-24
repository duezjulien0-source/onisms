"use client";

import { useState, useTransition } from "react";
import { Pencil, Pause, Play, Trash2 } from "lucide-react";
import { updateVABudget, toggleVAStatus, deleteVA } from "./actions";

interface Props {
  vaId: string;
  vaEmail: string;
  currentBudget: number;
  currentStatus: string;
}

export function VARowActions({ vaId, vaEmail, currentBudget, currentStatus }: Props) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(currentBudget));
  const [pending, startTransition] = useTransition();

  const saveBudget = () => {
    const fd = new FormData();
    fd.set("vaId", vaId);
    fd.set("budget", budgetValue);
    startTransition(async () => {
      const r = await updateVABudget(fd);
      if (!("error" in r)) setEditingBudget(false);
      else alert(r.error);
    });
  };

  const toggleStatus = () => {
    const fd = new FormData();
    fd.set("vaId", vaId);
    fd.set("currentStatus", currentStatus);
    startTransition(async () => {
      const r = await toggleVAStatus(fd);
      if ("error" in r) alert(r.error);
    });
  };

  const remove = () => {
    if (!confirm(`Supprimer définitivement le VA "${vaEmail}" ? Cette action est irréversible.`)) {
      return;
    }
    const fd = new FormData();
    fd.set("vaId", vaId);
    startTransition(async () => {
      const r = await deleteVA(fd);
      if ("error" in r) alert(r.error);
    });
  };

  if (editingBudget) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          step="0.5"
          value={budgetValue}
          onChange={(e) => setBudgetValue(e.target.value)}
          disabled={pending}
          className="w-20 px-2 py-1 text-sm bg-background border border-border rounded"
          autoFocus
        />
        <button
          onClick={saveBudget}
          disabled={pending}
          className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:opacity-90"
        >
          OK
        </button>
        <button
          onClick={() => {
            setEditingBudget(false);
            setBudgetValue(String(currentBudget));
          }}
          disabled={pending}
          className="text-xs px-2 py-1 bg-muted rounded"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditingBudget(true)}
        title="Modifier le budget"
        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={toggleStatus}
        disabled={pending}
        title={currentStatus === "active" ? "Suspendre" : "Réactiver"}
        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {currentStatus === "active" ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        onClick={remove}
        disabled={pending}
        title="Supprimer"
        className="p-1.5 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
