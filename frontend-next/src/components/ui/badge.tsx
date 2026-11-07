import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-[color:var(--interactive-foreground)]",
        success: "bg-[color:var(--success-light)] text-[color:var(--success-text)]",
        warning: "bg-[color:var(--warning-light)] text-[color:var(--warning-text)]",
        destructive: "bg-[color:var(--destructive-light)] text-[color:var(--destructive-text)]",
        info: "bg-[color:var(--info-light)] text-[color:var(--info-text)]",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
