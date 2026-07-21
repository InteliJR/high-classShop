import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;

export function DialogContent({
  title,
  children,
  className,
  hideTitle,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-ds-modal",
          className
        )}
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
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
