"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn(
          "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400",
          "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        disabled={props.disabled}
        tabIndex={-1}
        aria-label={show ? "隱藏密碼" : "顯示密碼"}
        title={show ? "隱藏密碼" : "顯示密碼"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
