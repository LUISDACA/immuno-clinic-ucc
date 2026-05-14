import * as React from "react";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmailInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <AtSign
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--primary)]"
        aria-hidden
      />
      <input
        ref={ref}
        type="email"
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-[color:var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
EmailInput.displayName = "EmailInput";
