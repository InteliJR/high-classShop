import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva("flex gap-3 items-start rounded-md border px-4 py-3 text-sm", {
  variants: {
    variant: {
      success: "bg-status-ok-wash border-status-ok-line text-status-ok",
      warning: "bg-status-neg-wash border-status-neg-line text-status-neg",
      danger: "bg-status-bad-wash border-status-bad-line text-status-bad",
      info: "bg-status-sched-wash border-status-sched-line text-status-sched",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
