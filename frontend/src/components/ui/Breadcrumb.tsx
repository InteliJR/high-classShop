// src/components/ui/Breadcrumb.tsx
import { Link, useParams } from "react-router-dom";

// Mapeamento de categorias técnicas para nomes amigáveis
const categoryLabels: Record<string, string> = {
  carros: "Carros",
  avioes: "Aviões", 
  barcos: "Barcos",
};

interface BreadcrumbProps {
  itemName?: string; // Opcional, se não passar usa o ID
}

export default function Breadcrumb({ itemName }: BreadcrumbProps) {
  // Extrai os parâmetros da URL automaticamente
  const { categoria, id } = useParams<{ categoria: string; id: string }>();

  // Se não tiver categoria, não renderiza nada
  if (!categoria) {
    return null;
  }

  // Ajusta os nomes
  const categoryLabel = categoryLabels[categoria.toLowerCase()] || categoria;

  const displayName = itemName || formatId(id || "");

  return (
    <nav 
      className="flex items-center text-sm text-gray-600 mb-6" 
      aria-label="Breadcrumb"
    >
      {/* Link para a página inicial */}
      <Link
        to="/"
        className="hover:text-gray-900 transition-colors hover:underline"
      >
        Início
      </Link>

      <span className="mx-2 text-gray-400" aria-hidden="true">
        ›
      </span>

      {/* Link para a listagem da categoria */}
      <Link
        to={`/${categoria}`}
        className="hover:text-gray-900 transition-colors hover:underline"
      >
        {categoryLabel}
      </Link>

      <span className="mx-2 text-gray-400" aria-hidden="true">
        ›
      </span>

      {/* Produto atual (não clicável) */}
      <span className="text-gray-900 font-medium" aria-current="page">
        {displayName}
      </span>
    </nav>
  );
}

// Função para formatar o ID da URL
function formatId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}