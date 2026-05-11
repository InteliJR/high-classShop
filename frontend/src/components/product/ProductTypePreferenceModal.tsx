import { Car, Ship, Plane, X } from "lucide-react";
import type { ReactNode } from "react";

export type PreferredProductType = "CAR" | "BOAT" | "AIRCRAFT";

interface ProductTypePreferenceModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onSelect: (type: PreferredProductType) => void;
}

const options: {
  type: PreferredProductType;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    type: "CAR",
    label: "Carros",
    description: "Modelos esportivos, SUVs e sedãs de luxo.",
    icon: <Car size={24} className="text-primary" />,
  },
  {
    type: "BOAT",
    label: "Embarcações",
    description: "Lanchas e embarcações para lazer e alto padrão.",
    icon: <Ship size={24} className="text-primary" />,
  },
  {
    type: "AIRCRAFT",
    label: "Aeronaves",
    description: "Jatos e aeronaves executivas premium.",
    icon: <Plane size={24} className="text-primary" />,
  },
];

export default function ProductTypePreferenceModal({
  isOpen,
  title,
  description,
  onClose,
  onSelect,
}: ProductTypePreferenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
          {options.map((option) => (
            <button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2">
                {option.icon}
              </div>
              <h3 className="font-semibold text-gray-900">{option.label}</h3>
              <p className="mt-1 text-xs text-gray-600">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
