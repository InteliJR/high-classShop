import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "./skeleton";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("bg-surface rounded-lg shadow overflow-x-auto", className)}>
      <table className="w-full min-w-[640px]">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-border-soft border-b border-border">{children}</thead>;
}

// `isLoading` + `columns` mostram linhas-skeleton no lugar de `children` enquanto
// os dados não chegam — mesma altura/largura das linhas reais, evita reflow.
export function TableBody({
  children,
  isLoading = false,
  skeletonRows = 5,
  columns = 1,
}: {
  children: ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  columns?: number;
}) {
  return (
    <tbody>
      {isLoading
        ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border-soft">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[160px]" />
                </td>
              ))}
            </tr>
          ))
        : children}
    </tbody>
  );
}

export function TableRow({
  children,
  className,
  expandedContent,
  isExpanded = false,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  expandedContent?: ReactNode;
  isExpanded?: boolean;
  colSpan?: number;
}) {
  return (
    <>
      <tr className={cn("border-b border-border-soft", className)}>{children}</tr>
      {isExpanded && expandedContent && (
        <tr className="border-b border-border-soft bg-border-soft">
          <td colSpan={colSpan} className="p-0">
            {expandedContent}
          </td>
        </tr>
      )}
    </>
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("text-left text-xs font-medium text-muted uppercase px-4 py-3", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-sm", className)} {...props} />;
}
