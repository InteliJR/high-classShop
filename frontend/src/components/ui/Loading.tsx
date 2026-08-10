import { Loader2 } from "lucide-react";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
}

/**
 * Spinner padrão da plataforma. Qualquer indicador de carregamento deve ser
 * este componente ou `<Loader2 className="animate-spin" />` direto (inline,
 * dentro de botões) — nada de anéis de border custom.
 */
export default function Loading({ size = "md", text, fullScreen = false }: LoadingProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const containerClasses = fullScreen
    ? "flex flex-col items-center justify-center min-h-screen gap-4"
    : "flex flex-col items-center justify-center gap-4";

  return (
    <div className={containerClasses}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />

      {text && (
        <p className={`${textSizeClasses[size]} text-muted font-medium`}>
          {text}
        </p>
      )}
    </div>
  );
}
