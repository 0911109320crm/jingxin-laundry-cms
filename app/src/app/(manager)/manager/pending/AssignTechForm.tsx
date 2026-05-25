"use client";

import { useState, useTransition } from "react";
import { assignTechnicianAction } from "./actions";

type Tech = { id: string; name: string };

export function AssignTechForm({
  orderId,
  technicians,
}: {
  orderId: string;
  technicians: Tech[];
}) {
  const [techId, setTechId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const assign = () => {
    if (!techId) {
      alert("請選擇師傅");
      return;
    }
    startTransition(async () => {
      const res = await assignTechnicianAction(orderId, techId);
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={techId}
        onChange={(e) => setTechId(e.target.value)}
        disabled={pending}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">— 派給 —</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={assign}
        disabled={pending || !techId}
        className="rounded bg-brand-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {pending ? "派工中..." : "派工"}
      </button>
    </div>
  );
}
