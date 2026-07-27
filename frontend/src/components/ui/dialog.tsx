import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;

export function DialogContent({
  open,
  title,
  children,
  className,
  hideTitle,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.15;

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
            <motion.div
              className={cn(
                "fixed left-1/2 top-1/2 z-50 w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-ds-modal",
                className
              )}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration }}
            >
              <div className={cn("flex items-center mb-4", hideTitle ? "justify-end" : "justify-between")}>
                <DialogPrimitive.Title className={cn("text-base font-semibold text-ink", hideTitle && "sr-only")}>
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="text-muted hover:text-ink"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </DialogPrimitive.Close>
              </div>
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
