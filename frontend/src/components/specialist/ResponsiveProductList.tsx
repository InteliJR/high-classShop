import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import type { ProductCurrency } from "../../types/types";

export interface ProductListItem {
  id: string;
  marca: string;
  modelo: string;
  ano?: number;
  valor: number | string;
  currency: ProductCurrency;
  estado?: string;
  descricao?: string;
  imageUrl?: string;
  // Ausente = ativo (listas antigas não mandam o campo).
  is_active?: boolean;
}

interface ResponsiveProductListProps {
  products: ProductListItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function getProductName(product: ProductListItem) {
  return `${product.marca} ${product.modelo}`.trim();
}

function CurrencyBadge({ currency }: { currency: ProductCurrency }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-border bg-bg px-2 py-0.5 text-xs font-medium text-ink-soft">
      Produto {currency}
    </span>
  );
}

function isInactive(product: ProductListItem) {
  return product.is_active === false;
}

// Desativar não apaga: o produto sai do catálogo público mas continua na
// lista do especialista, por isso o selo e a ausência do botão de desativar.
function InactiveBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-border-soft px-2 py-0.5 text-xs font-medium text-muted">
      Inativo
    </span>
  );
}

function ProductImage({
  product,
  className,
}: {
  product: ProductListItem;
  className: string;
}) {
  if (!product.imageUrl) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-border bg-border-soft text-xs text-subtle`}
      >
        sem foto
      </div>
    );
  }

  return (
    <img
      src={product.imageUrl}
      alt={getProductName(product)}
      className={`${className} shrink-0 rounded-lg border border-border object-cover`}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

export default function ResponsiveProductList({
  products,
  onEdit,
  onDelete,
}: ResponsiveProductListProps) {
  return (
    <>
      <div
        data-testid="product-card-list"
        className="grid gap-4 sm:grid-cols-2 xl:hidden"
      >
        {products.map((product) => {
          const productName = getProductName(product);

          return (
            <article
              key={product.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ProductImage product={product} className="h-20 w-20" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="min-w-0 break-words text-base font-semibold text-ink">
                      {productName}
                    </h3>
                    <CurrencyBadge currency={product.currency} />
                    {isInactive(product) && <InactiveBadge />}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {formatCurrency(product.valor, product.currency)}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border-soft pt-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    Ano
                  </dt>
                  <dd className="mt-1 text-ink">{product.ano || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    Estado
                  </dt>
                  <dd className="mt-1 capitalize text-ink">
                    {product.estado || "-"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(product.id)}
                  className={`${isInactive(product) ? "col-span-2 " : ""}inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-border-soft`}
                  aria-label={`Editar ${productName}`}
                >
                  <Pencil size={16} />
                  Editar
                </button>
                {!isInactive(product) && (
                  <button
                    type="button"
                    onClick={() => onDelete(product.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-status-bad/30 px-3 py-2 text-sm font-medium text-status-bad transition hover:bg-status-bad-wash"
                    aria-label={`Desativar ${productName}`}
                  >
                    <Trash2 size={16} />
                    Desativar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div data-testid="product-table" className="hidden overflow-hidden xl:block">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="border-b border-border">
            <tr className="text-left">
              <th className="pb-3 text-sm font-medium text-muted">Produto</th>
              <th className="pb-3 text-sm font-medium text-muted">Ano</th>
              <th className="pb-3 text-sm font-medium text-muted">Valor</th>
              <th className="pb-3 text-sm font-medium text-muted">Estado</th>
              <th className="pb-3 text-right text-sm font-medium text-muted">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const productName = getProductName(product);

              return (
                <tr
                  key={product.id}
                  className="border-b border-border-soft hover:bg-border-soft/50"
                >
                  <td className="py-3 pr-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImage product={product} className="h-14 w-14" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className="min-w-0 truncate font-medium text-ink"
                            title={productName}
                          >
                            {productName}
                          </span>
                          <CurrencyBadge currency={product.currency} />
                          {isInactive(product) && <InactiveBadge />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-ink-soft">
                    {product.ano || "-"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 font-medium text-ink">
                    {formatCurrency(product.valor, product.currency)}
                  </td>
                  <td className="py-3 pr-3 capitalize text-ink-soft">
                    {product.estado || "-"}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(product.id)}
                        className="rounded p-2 text-ink-soft transition hover:bg-border-soft"
                        aria-label={`Editar ${productName}`}
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      {/* Espaço do botão ausente mantém o lápis alinhado. */}
                      {isInactive(product) && (
                        <span className="w-[34px]" aria-hidden />
                      )}
                      {!isInactive(product) && (
                        <button
                          type="button"
                          onClick={() => onDelete(product.id)}
                          className="rounded p-2 text-status-bad transition hover:bg-status-bad-wash"
                          aria-label={`Desativar ${productName}`}
                          title="Desativar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
