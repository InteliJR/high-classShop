import ProductCarousel from "./ProductCarousel";
import type { Product } from "../../types/types";

interface ProductDetailsProps {
  product: Product;
}

export default function ProductDetails({ product }: ProductDetailsProps) {
  // Filtrar URLs vazias de imagens
  const validImageUrls = (
    product.images?.map((img: any) => img.image_url) || [product.imageUrl || ""]
  ).filter((url) => url && url.trim() !== "");

  // Função auxiliar para formatar valores monetários
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "N/A";

    let numValue: number | null = null;

    if (typeof value === "number") {
      numValue = value;
    } else if (typeof value === "string") {
      // Try to parse strings like "950000" or "950.000,00"
      const sanitized = value.replace(/\./g, "").replace(/,/g, ".");
      const parsed = Number(sanitized);
      numValue = Number.isNaN(parsed) ? null : parsed;
    } else if (Array.isArray(value)) {
      numValue = Number(value[0]);
    } else if (typeof value === "object") {
      // Common Decimal-like objects (Prisma/decimal.js)
      if (typeof value.toNumber === "function") {
        try {
          numValue = value.toNumber();
        } catch (e) {
          numValue = null;
        }
      }

      // fallback: try toString()
      if (numValue === null && typeof value.toString === "function") {
        const str = value.toString();
        const parsed = Number(str.replace(/\./g, "").replace(/,/g, "."));
        numValue = Number.isNaN(parsed) ? null : parsed;
      }

      // If the object looks like Decimal internals {d:[], e: number, s: 1|-1}
      if (
        numValue === null &&
        Object.prototype.hasOwnProperty.call(value, "d") &&
        Object.prototype.hasOwnProperty.call(value, "e") &&
        Object.prototype.hasOwnProperty.call(value, "s")
      ) {
        try {
          const digits = (value.d || []).join("");
          const len = digits.length;
          const exp = value.e - (len - 1);
          const baseNum = Number(digits);
          if (!Number.isNaN(baseNum)) {
            numValue = baseNum * Math.pow(10, exp) * (value.s === -1 ? -1 : 1);
          }
        } catch (e) {
          numValue = null;
        }
      }
    }

    if (numValue === null || Number.isNaN(numValue)) return "N/A";

    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  };

  // Função auxiliar para formatar números
  const formatNumber = (value: number | undefined) => {
    if (!value) return "N/A";
    return value.toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-8">
      {/* Carrossel de Imagens */}
      {validImageUrls.length > 0 && (
        <div className="rounded-lg overflow-hidden">
          <ProductCarousel imageUrls={validImageUrls} />
        </div>
      )}

      {/* Informações Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <InfoCard label="Marca" value={product.marca} />
        <InfoCard label="Modelo" value={product.modelo} />
        <InfoCard label="Ano" value={product.ano?.toString()} />
        <InfoCard label="Valor" value={formatValue(product.valor)} highlight />
        <InfoCard label="Estado" value={product.estado} />
      </div>

      {/* Campos específicos de Carros */}
      {product.cor ||
      product.km ||
      product.cambio ||
      product.combustivel ||
      product.tipo_categoria ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informações do Produto
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {product.cor && <InfoCard label="Cor" value={product.cor} />}
            {product.km && (
              <InfoCard
                label="Quilometragem (km)"
                value={formatNumber(product.km)}
              />
            )}
            {product.cambio && (
              <InfoCard label="Câmbio" value={product.cambio} />
            )}
            {product.combustivel && (
              <InfoCard label="Combustível" value={product.combustivel} />
            )}
            {product.tipo_categoria && (
              <InfoCard label="Tipo/Categoria" value={product.tipo_categoria} />
            )}
          </div>
        </div>
      ) : null}

      {/* Campos específicos de Lanchas */}
      {product.fabricante ||
      product.tamanho ||
      product.estilo ||
      product.motor ||
      product.tipo_embarcacao ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informações da Embarcação
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {product.fabricante && (
              <InfoCard label="Fabricante" value={product.fabricante} />
            )}
            {product.tamanho && (
              <InfoCard label="Tamanho" value={product.tamanho} />
            )}
            {product.estilo && (
              <InfoCard label="Estilo" value={product.estilo} />
            )}
            {product.motor && <InfoCard label="Motor" value={product.motor} />}
            {product.ano_motor && (
              <InfoCard
                label="Ano do Motor"
                value={product.ano_motor.toString()}
              />
            )}
            {product.tipo_embarcacao && (
              <InfoCard
                label="Tipo de Embarcação"
                value={product.tipo_embarcacao}
              />
            )}
            {product.combustivel && (
              <InfoCard label="Combustível" value={product.combustivel} />
            )}
            {product.acessorios && (
              <InfoCard label="Acessórios" value={product.acessorios} />
            )}
          </div>
        </div>
      ) : null}

      {/* Campos específicos de Aeronaves */}
      {product.categoria || product.assentos || product.tipo_aeronave ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informações da Aeronave
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {product.categoria && (
              <InfoCard label="Categoria" value={product.categoria} />
            )}
            {product.assentos && (
              <InfoCard label="Assentos" value={product.assentos.toString()} />
            )}
            {product.tipo_aeronave && (
              <InfoCard
                label="Tipo de Aeronave"
                value={product.tipo_aeronave}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Descrição */}
      {product.descricao || product.descricao_completa ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Descrição
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 text-gray-700 leading-relaxed">
            <p className="whitespace-pre-wrap text-sm">
              {product.descricao || product.descricao_completa}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Componente auxiliar para exibir cada informação
interface InfoCardProps {
  label: string;
  value: string | undefined;
  highlight?: boolean;
}

function InfoCard({ label, value, highlight }: InfoCardProps) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlight ? "bg-green-50 border border-green-200" : "bg-gray-50"
      }`}
    >
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-green-700" : "text-gray-900"
        }`}
      >
        {value || "Não informado"}
      </p>
    </div>
  );
}
