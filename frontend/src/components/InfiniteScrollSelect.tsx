import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Loader, X } from "lucide-react";

export interface InfiniteScrollOption {
  id: string | number;
  label: string;
  [key: string]: any; // Allow additional properties
}

interface InfiniteScrollSelectProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onLoadMore: (page: number) => Promise<InfiniteScrollOption[]>;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

/**
 * InfiniteScrollSelect Component
 *
 * Custom select with infinite scroll capability for large datasets.
 * Replaces traditional <select> for better UX with many options.
 *
 * Features:
 * - Dropdown with search field
 * - Infinite scroll using Intersection Observer
 * - Local search filtering
 * - Loading states
 * - Clear selection button
 */
export default function InfiniteScrollSelect({
  label,
  placeholder,
  value,
  onChange,
  onLoadMore,
  disabled = false,
  error,
  required = false,
}: InfiniteScrollSelectProps) {
  const [options, setOptions] = useState<InfiniteScrollOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Selected option for display
  const selectedOption = options.find(
    (opt) => String(opt.id) === String(value)
  );

  // Load initial data
  useEffect(() => {
    loadOptions(1, true);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!isOpen || !observerTarget.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadOptions(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);

    return () => observer.disconnect();
  }, [isOpen, hasMore, isLoading, page]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const loadOptions = async (pageNum: number, reset = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const newOptions = await onLoadMore(pageNum);

      if (reset) {
        setOptions(newOptions);
        setIsInitialLoad(false);
      } else {
        setOptions((prev) => [...prev, ...newOptions]);
      }

      setPage(pageNum);
      setHasMore(newOptions.length > 0);
    } catch (error) {
      console.error("Erro ao carregar opções:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (optionId: string | number) => {
    onChange(String(optionId));
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
  };

  // Filter options by search term
  const filteredOptions = searchTerm
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between transition ${
          error
            ? "border-red-500 bg-red-50"
            : "border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50"
            : "bg-white hover:bg-gray-50"
        }`}
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {isInitialLoad && isLoading
            ? "Carregando..."
            : selectedOption
            ? selectedOption.label
            : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <X
              size={16}
              className="text-gray-400 hover:text-gray-600"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {error && <p className="text-xs sm:text-sm text-red-600 mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 && !isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchTerm
                  ? "Nenhum resultado encontrado"
                  : "Nenhuma opção disponível"}
              </div>
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-slate-50 transition ${
                      String(option.id) === String(value)
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}

                {/* Infinite Scroll Trigger */}
                {hasMore && !searchTerm && (
                  <div
                    ref={observerTarget}
                    className="p-4 text-center text-sm text-gray-500"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader size={16} className="animate-spin" />
                        <span>Carregando mais...</span>
                      </div>
                    ) : (
                      <span>Role para carregar mais</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
