import { useCallback, useLayoutEffect, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
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
  dismissible = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onPortalContainerChange,
  portalActive = false,
  portalLabel,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
  dismissible?: boolean;
  onOpenAutoFocus?: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>["onCloseAutoFocus"];
  onPortalContainerChange?(element: HTMLDivElement | null): void;
  portalActive?: boolean;
  portalLabel?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.15;
  const portalRef = useRef<HTMLDivElement | null>(null);
  const setPortalContainer = useCallback((element: HTMLDivElement | null) => {
    portalRef.current = element;
    onPortalContainerChange?.(element);
  }, [onPortalContainerChange]);

  useLayoutEffect(() => {
    const portal = portalRef.current;
    if (open && portalActive && portal && !portal.contains(document.activeElement)) {
      portal.focus({ preventScroll: true });
    }
  }, [open, portalActive]);

  const panel = (
    <motion.div
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-ds-modal",
        className
      )}
      hidden={Boolean(onPortalContainerChange && portalActive)}
      inert={Boolean(onPortalContainerChange && portalActive)}
      aria-hidden={onPortalContainerChange && portalActive ? true : undefined}
      style={onPortalContainerChange ? { pointerEvents: portalActive ? "none" : "auto" } : undefined}
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
          disabled={!dismissible}
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </div>
      {children}
    </motion.div>
  );

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
          <DialogPrimitive.Content
            asChild
            forceMount
            aria-describedby={undefined}
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={(event) => {
              if (!dismissible) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (!dismissible) event.preventDefault();
            }}
          >
            {onPortalContainerChange ? (
              // Keep viewport portals inside the focus scope without inheriting the panel's transform or overflow.
              <div className="fixed inset-0 z-50" style={{ pointerEvents: "none" }}>
                {panel}
                <div
                  ref={setPortalContainer}
                  tabIndex={-1}
                  role="group"
                  aria-label={portalLabel}
                  style={{ pointerEvents: "auto" }}
                />
              </div>
            ) : panel}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
