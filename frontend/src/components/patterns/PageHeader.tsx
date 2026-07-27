import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

export interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, showBack = false, backTo, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex flex-col gap-1">
        {showBack && <BackButton to={backTo} />}
        <h1 className="text-h1 font-bold text-ink">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
