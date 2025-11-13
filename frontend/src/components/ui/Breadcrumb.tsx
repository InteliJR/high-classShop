// src/components/ui/Breadcrumb.tsx
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from 'lucide-react';


// Traduz os nomes técnicos.
const categoryLabels: Record<string, string> = {
  carros: "Carros",
  avioes: "Aviões",
  barcos: "Barcos",
};

// O componente agora aceita props opcionais. Mock.
interface BreadcrumbProps {
  category?: string;
  itemName?: string;
}


export default function Breadcrumb({ category, itemName }: BreadcrumbProps) {

  const { categoria, id } = useParams<{ categoria?: string; id?: string }>();

  const currentCategory = category || categoria; 
  const currentItem = itemName || formatId(id || ""); // prioriza props, senão usa a URL

  const categoryLabel =
    currentCategory &&
    (categoryLabels[currentCategory.toLowerCase()] || currentCategory);

  if (!currentCategory && !currentItem) return null;   // se não tiver categoria nem item, não mostra nada


  return (
    <nav
      className="flex items-center text-gray-900 mb-6"
      aria-label="breadcrumb"
    >
      
      {/* Se houver categoria, mostra */}
      {categoryLabel && (
        <>
          <Link
            to={`/${currentCategory}`}
            className="hover:text-gray-700 hover:underline transition-colors text-4xl"
          >
            {categoryLabel}
          </Link>
        </>
      )}

      {/* Se houver item, mostra */}
      {currentItem && (
        <>
         <ChevronRight className="w-3 h-3 mx-3 text-gray-500" />
         <span className="text-gray-900 font-medium text-2xl">{currentItem}</span>
        </>
      )}
    </nav>
  );
}

// Transforma "toyota-corolla" → "Toyota Corolla"
function formatId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
