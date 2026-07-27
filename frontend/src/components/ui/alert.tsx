import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion } from "framer-motion";
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
  extends Omit<HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd">,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
      {...props}
    />
  );
}
