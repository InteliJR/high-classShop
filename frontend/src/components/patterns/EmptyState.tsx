import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-12 px-4 border border-dashed border-border rounded-lg",
        className
      )}
    >
      <Icon className="mx-auto mb-3 h-8 w-8 text-subtle" />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-muted mt-1 mb-4">{description}</p>}
      {action}
    </div>
  );
}
