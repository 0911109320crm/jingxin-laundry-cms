"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshReminders } from "@/app/(admin)/reminders/actions";
import { Button } from "@/components/ui/Button";

export function RefreshButton() {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await refreshReminders();
      if (!res.ok) alert(res.error);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={pending}
    >
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {pending ? "掃描中…" : "重新掃描"}
    </Button>
  );
}
