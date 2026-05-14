"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  iconLock?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, iconLock = true, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        {iconLock && (
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--primary)]"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn(
            "flex h-11 w-full rounded-xl border border-input bg-card py-2.5 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-[color:var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-50",
            iconLock ? "pl-10" : "pl-3.5",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/10"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
